import { prisma, productImage } from "./db";
import { dayKey, startOfDay, startOfMonth } from "./time";

const confirmed = { status: "CONFIRMADA" as const };

/**
 * Quantos pedidos houve no período: cada venda comum conta 1, e cada encomenda conta 1
 * mesmo com várias vendas (sinal, pagamentos e restante na entrega).
 */
async function countOrders(from: Date) {
  const [plain, fromOrders] = await Promise.all([
    prisma.sale.count({
      where: { ...confirmed, createdAt: { gte: from }, OR: [{ externalRef: null }, { NOT: { externalRef: { startsWith: "encomenda" } } }] },
    }),
    prisma.sale.findMany({
      where: { ...confirmed, createdAt: { gte: from }, externalRef: { startsWith: "encomenda" } },
      select: { externalRef: true },
    }),
  ]);
  const paymentIds = fromOrders.map((s) => s.externalRef!).filter((r) => r.startsWith("encomenda-pagamento:")).map((r) => r.slice(20));
  const payments = paymentIds.length
    ? await prisma.orderPayment.findMany({ where: { id: { in: paymentIds } }, select: { orderId: true } })
    : [];
  const orderIds = new Set([
    ...fromOrders.map((s) => s.externalRef!).filter((r) => r.startsWith("encomenda:")).map((r) => r.slice(10)),
    ...payments.map((p) => p.orderId),
  ]);
  return plain + orderIds.size;
}

async function totals(from: Date) {
  const [agg, orders] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...confirmed, createdAt: { gte: from } },
      _sum: { total: true, totalCost: true },
    }),
    countOrders(from),
  ]);
  const revenue = Number(agg._sum.total ?? 0);
  const cost = Number(agg._sum.totalCost ?? 0);
  return { revenue, cost, profit: revenue - cost, orders };
}

export async function getOverview() {
  const [today, week, month] = await Promise.all([
    totals(startOfDay(0)),
    totals(startOfDay(6)),
    totals(startOfMonth()),
  ]);
  return { today, week, month };
}

/** Faturamento por dia nos últimos `days` dias (fuso de La Paz). */
export async function getDailySeries(days = 14) {
  const from = startOfDay(days - 1);
  const sales = await prisma.sale.findMany({
    where: { ...confirmed, createdAt: { gte: from } },
    select: { createdAt: true, total: true },
  });
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(dayKey(startOfDay(i)), { revenue: 0, orders: 0 });
  }
  for (const s of sales) {
    const d = byDay.get(dayKey(s.createdAt));
    if (d) {
      d.revenue += Number(s.total);
      d.orders += 1;
    }
  }
  return [...byDay.entries()].map(([day, v]) => ({ day, ...v }));
}

/** Produtos mais vendidos desde `from`, agrupados por produto (somando tamanhos). */
export async function getTopProducts(from: Date, limit = 6) {
  const items = await prisma.saleItem.findMany({
    where: { sale: { ...confirmed, createdAt: { gte: from } } },
    select: {
      quantity: true,
      unitPrice: true,
      unitCost: true,
      variant: { select: { product: { select: { id: true, name: true, imageUrl: true, photoUpdatedAt: true } } } },
    },
  });
  const map = new Map<string, { id: string; name: string; image: string | null; quantity: number; revenue: number; profit: number }>();
  for (const i of items) {
    const p = i.variant.product;
    const row = map.get(p.id) ?? { id: p.id, name: p.name, image: productImage(p), quantity: 0, revenue: 0, profit: 0 };
    row.quantity += i.quantity;
    row.revenue += Number(i.unitPrice) * i.quantity;
    row.profit += (Number(i.unitPrice) - Number(i.unitCost)) * i.quantity;
    map.set(p.id, row);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export async function getSalesByChannel(from: Date) {
  const rows = await prisma.sale.groupBy({
    by: ["channel"],
    where: { ...confirmed, createdAt: { gte: from } },
    _sum: { total: true },
    _count: true,
  });
  return rows
    .map((r) => ({ channel: r.channel, revenue: Number(r._sum.total ?? 0), orders: r._count }))
    .sort((a, b) => b.revenue - a.revenue);
}
