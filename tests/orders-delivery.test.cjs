const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ total = 230, paid = 115, booked = true, failPayment = false, failSale = false } = {}) {
  let data = {
    order: { id: "order", number: 6, total, paid, status: "PENDENTE", channel: "WHATSAPP", product: "Torta G", customerName: "Cliente", saleId: null },
    payments: paid ? [{ id: "deposit", orderId: "order", amount: paid, method: "EFECTIVO", saleId: booked ? "deposit-sale" : null }] : [],
    sales: paid && booked ? [{ id: "deposit-sale", total: paid, status: "CONFIRMADA" }] : [],
    activities: [],
  };
  let queue = Promise.resolve();
  function client(state) {
    return {
      order: {
        updateMany: async ({ where, data: change }) => {
          if (where.id !== state.order.id || (where.status && where.status !== state.order.status)) return { count: 0 };
          if (change.status) state.order.status = change.status;
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({ ...state.order, payments: [...state.payments] }),
        findUnique: async () => ({ ...state.order, payments: [...state.payments] }),
        update: async ({ data: change }) => Object.assign(state.order, change),
      },
      orderPayment: {
        create: async ({ data: payment }) => {
          if (failPayment) throw new Error("payment write failed");
          const created = { id: "payment-" + state.payments.length, ...payment };
          state.payments.push(created);
          return created;
        },
        aggregate: async () => ({ _sum: { amount: state.payments.reduce((sum, p) => sum + p.amount, 0) } }),
        findMany: async () => state.payments.filter(p => p.saleId),
        findUnique: async ({ where }) => {
          const payment = state.payments.find(p => p.id === where.id);
          return payment && { ...payment, order: { ...state.order } };
        },
        update: async ({ where, data: change }) => Object.assign(state.payments.find(p => p.id === where.id), change),
      },
      variant: { findFirst: async () => ({ id: "internal-order-variant" }) },
      sale: { findMany: async ({ where }) => state.sales.filter(s => where.id.in.includes(s.id) && s.status === where.status) },
      _state: state,
    };
  }
  const prisma = {
    $transaction: (callback) => {
      const job = queue.then(async () => {
        const copy = structuredClone(data);
        const result = await callback(client(copy));
        data = copy;
        return result;
      });
      queue = job.catch(() => {});
      return job;
    },
  };
  class InventoryError extends Error {}
  const inventory = {
    InventoryError,
    createSale: async (input, tx) => {
      assert.ok(tx?._state, "sale must share the payment/delivery transaction");
      if (failSale) throw new Error("sale write failed");
      const sale = { id: "sale-" + tx._state.sales.length, total: input.items[0].unitPrice, method: input.payment, status: "CONFIRMADA" };
      tx._state.sales.push(sale);
      return sale;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../lib/orders.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "./db") return { prisma };
      if (name === "./inventory") return inventory;
      // Baixa de estoque das encomendas é testada em order-stock.test.cjs.
      if (name === "./order-stock") return { syncOrderStock: async () => ({ ok: true, changes: [] }) };
      if (name === "./order-history") return { recordOrderActivity: async(tx,orderId,action,userId)=>tx._state.activities.push({orderId,action,userId}) };
      throw new Error("Unexpected import: " + name);
    },
  });
  return { api: exports, state: () => data };
}

test("delivery receives only the remaining 115 and uses the selected method", async () => {
  const f = fixture();
  await f.api.deliverOrder("order", "user", "TARJETA");
  const s = f.state();
  assert.equal(s.order.status, "ENTREGUE");
  assert.equal(s.activities[0].userId, "user");
  assert.equal(s.activities[0].action, "Marcado como entregue");
  assert.equal(s.order.paid, 230);
  assert.equal(s.payments.length, 2);
  assert.equal(s.payments[1].amount, 115);
  assert.equal(s.payments[1].method, "TARJETA");
  assert.equal(s.payments[1].saleId, s.order.saleId);
  assert.equal(s.sales.reduce((sum, sale) => sum + sale.total, 0), 230);
});

test("fully paid order adds neither payment nor revenue", async () => {
  const f = fixture({ paid: 230 });
  await f.api.deliverOrder("order");
  assert.equal(f.state().payments.length, 1);
  assert.equal(f.state().sales.length, 1);
  assert.equal(f.state().order.status, "ENTREGUE");
});

test("unpaid order receives the full total", async () => {
  const f = fixture({ paid: 0 });
  await f.api.deliverOrder("order", "user", "QR");
  assert.equal(f.state().order.paid, 230);
  assert.equal(f.state().payments[0].amount, 230);
  assert.equal(f.state().sales[0].total, 230);
});

test("legacy deposit not yet booked is included once in revenue", async () => {
  const f = fixture({ booked: false });
  await f.api.deliverOrder("order");
  assert.equal(f.state().payments[1].amount, 115);
  assert.equal(f.state().sales[0].total, 230);
  assert.equal(f.state().order.paid, 230);
});

test("repeated or concurrent delivery does not duplicate payment or revenue", async () => {
  const f = fixture();
  await Promise.all([f.api.deliverOrder("order"), f.api.deliverOrder("order")]);
  await f.api.deliverOrder("order");
  assert.equal(f.state().payments.length, 2);
  assert.equal(f.state().sales.length, 2);
  assert.equal(f.state().activities.length, 1);
});

test("manual receive alongside delivery does not double charge", async () => {
  const f = fixture();
  await Promise.all([f.api.addPayment("order", 115, "EFECTIVO"), f.api.deliverOrder("order")]);
  assert.equal(f.state().payments.length, 2);
  assert.equal(f.state().order.paid, 230);
  assert.equal(f.state().sales.reduce((sum, sale) => sum + sale.total, 0), 230);
});

for (const fault of ["failPayment", "failSale"]) {
  test(fault + " rolls back payment, revenue and delivery together", async () => {
    const f = fixture({ [fault]: true });
    await assert.rejects(f.api.deliverOrder("order"));
    assert.equal(f.state().order.status, "PENDENTE");
    assert.equal(f.state().order.paid, 115);
    assert.equal(f.state().payments.length, 1);
    assert.equal(f.state().sales.length, 1);
    assert.equal(f.state().activities.length, 0);
  });
}

test("cent amounts are rounded to cents and zero total needs no payment", async () => {
  const f = fixture({ total: 0.3, paid: 0.1 });
  await f.api.deliverOrder("order");
  assert.equal(f.state().payments[1].amount, 0.2);
  const zero = fixture({ total: 0, paid: 0 });
  await zero.api.deliverOrder("order");
  assert.equal(zero.state().payments.length, 0);
  assert.equal(zero.state().sales.length, 0);
});
