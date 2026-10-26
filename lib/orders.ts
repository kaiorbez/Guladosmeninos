// Regras das encomendas: pagamentos e a venda gerada na entrega.
import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { InventoryError, cancelSale, createSale } from "./inventory";
import { recordOrderActivity } from "./order-history";
import { syncOrderStock } from "./order-stock";

export class OrderError extends Error {}

const ORDER_PRODUCT = "Encomenda";
type Tx = Prisma.TransactionClient;

/**
 * Item usado nas vendas geradas por encomendas (o produto da ficha é texto livre).
 * Fica inativo: não aparece no cardápio do agente nem na tela de venda.
 */
async function orderVariantId(db: Tx = prisma) {
  const existing = await db.variant.findFirst({ where: { name: "Sob consulta", product: { name: ORDER_PRODUCT } } });
  if (existing) return existing.id;
  const category =
    (await db.category.findUnique({ where: { slug: "personalizadas" } })) ??
    (await db.category.findFirstOrThrow({ orderBy: { sortOrder: "desc" } }));
  const product = await db.product.create({
    data: {
      name: ORDER_PRODUCT,
      description: "Usado pelas vendas geradas ao entregar uma encomenda.",
      categoryId: category.id,
      priceOnRequest: true,
      trackStock: false,
      onStore: false,
      active: false,
      variants: { create: { name: "Sob consulta", price: 0 } },
    },
    include: { variants: true },
  });
  return product.variants[0].id;
}

/** Minutos de tolerância depois do horário combinado antes de avisar atraso. */
export const LATE_AFTER_MIN = 30;

/** Agora em La Paz (UTC-4): dia "YYYY-MM-DD" e minutos desde a meia-noite. */
function nowLaPaz(now = new Date()) {
  const local = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return { day: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/**
 * Quantos minutos a encomenda pendente está atrasada (null = no prazo).
 * Com horário: atrasa 30 min depois dele. Sem horário: só quando o dia já passou.
 */
export function minutesLate(o: { status: string; deliveryDate: Date; deliveryTime: string | null }, now = new Date()) {
  if (o.status !== "PENDENTE") return null;
  const { day, minutes } = nowLaPaz(now);
  const orderDay = o.deliveryDate.toISOString().slice(0, 10);
  const m = /^(\d{1,2}):(\d{2})$/.exec(o.deliveryTime ?? "");
  const due = m ? Number(m[1]) * 60 + Number(m[2]) : null;
  if (orderDay > day) return null;
  if (orderDay < day) {
    const daysLate = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${orderDay}T00:00:00Z`)) / 86_400_000);
    return daysLate * 1440 + minutes - (due ?? 0);
  }
  if (due === null) return null;
  const late = minutes - due;
  return late >= LATE_AFTER_MIN ? late : null;
}

/** "45 min", "2 h 10 min", "1 dia" */
export function lateLabel(min: number) {
  if (min >= 1440) {
    const d = Math.floor(min / 1440);
    return `${d} dia${d > 1 ? "s" : ""}`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

/** AI orders stay out of the kitchen and pending lists until a payment is recorded (owners' request, 16/10). */
export const UNPAID_AI: Prisma.OrderWhereInput = { agentRef: { not: null }, paid: 0 };
export const NOT_UNPAID_AI: Prisma.OrderWhereInput = { NOT: UNPAID_AI };

/** Encomendas pendentes atrasadas (para o aviso no topo do painel). */
export async function lateOrders() {
  const { day } = nowLaPaz();
  const pending = await prisma.order.findMany({
    where: { status: "PENDENTE", deliveryDate: { lte: new Date(`${day}T00:00:00Z`) }, ...NOT_UNPAID_AI },
    select: { id: true, number: true, customerName: true, deliveryDate: true, deliveryTime: true, status: true },
    orderBy: [{ deliveryDate: "asc" }, { deliveryTime: "asc" }],
  });
  return pending
    .map((o) => ({ ...o, late: minutesLate(o) }))
    .filter((o): o is typeof o & { late: number } => o.late !== null);
}

/** URL da foto da decoração (a data na URL troca o cache quando a foto muda). */
export function decorationPhotoUrl(o: { id: string; decorationPhotoAt: Date | null }) {
  return o.decorationPhotoAt ? `/api/encomendas/${o.id}/foto?v=${o.decorationPhotoAt.getTime()}` : null;
}

/** Recalcula o total pago a partir dos pagamentos. */
export async function refreshPaid(orderId: string, db: Tx = prisma) {
  const { _sum } = await db.orderPayment.aggregate({ where: { orderId }, _sum: { amount: true } });
  await db.order.update({ where: { id: orderId }, data: { paid: _sum.amount ?? 0 } });
  // Pagamento confirmado (ou removido) acerta a baixa de estoque dos itens da encomenda.
  await syncOrderStock(db, orderId);
}

/** Primeira linha dos produtos, para a descrição da venda. */
const productTitle = (product: string) => product.split("\n")[0].trim().slice(0, 80);

/**
 * Leva um pagamento ao faturamento no dia em que foi recebido: cria uma venda com o valor
 * pago e liga ao pagamento. Na entrega entra só o que ainda faltava faturar.
 */
export async function bookPayment(paymentId: string, userId?: string, transaction?: Tx) {
  const db = transaction ?? prisma;
  const payment = await db.orderPayment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || payment.saleId) return;
  const o = payment.order;
  const sale = await createSale({
    items: [
      {
        variantId: await orderVariantId(db),
        quantity: 1,
        unitPrice: Number(payment.amount),
        description: `Encomenda #${o.number}: ${productTitle(o.product)} (pagamento)`,
      },
    ],
    channel: o.channel,
    payment: payment.method,
    customerName: o.customerName,
    customerPhone: o.customerPhone ?? undefined,
    notes: `Pagamento da encomenda #${o.number}`,
    userId,
    externalRef: `encomenda-pagamento:${payment.id}`,
  }, transaction);
  await db.orderPayment.update({ where: { id: payment.id }, data: { saleId: sale.id } });
}

export async function addPayment(orderId: string, amount: number, method: PaymentMethod, userId?: string) {
  if (!Number.isFinite(amount) || !(amount > 0)) throw new OrderError("Informe um valor maior que zero.");
  return prisma.$transaction(async (tx) => {
    // A escrita bloqueia a encomenda até o fim da transação, inclusive contra uma entrega simultânea.
    const { count } = await tx.order.updateMany({ where: { id: orderId }, data: { paid: { increment: 0 } } });
    if (!count) throw new OrderError("Encomenda não encontrada.");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const missing = Number(order.total) - Number(order.paid);
    if (amount > missing + 0.001) throw new OrderError(`Falta receber só Bs ${missing.toLocaleString("pt-BR")}.`);
    const payment = await tx.orderPayment.create({ data: { orderId, amount, method } });
    await refreshPaid(orderId, tx);
    // Encomenda já entregue: o valor já entrou no faturamento pela venda da entrega.
    if (order.status !== "ENTREGUE") await bookPayment(payment.id, userId, tx);
  });
}

/** Apaga o pagamento e tira do faturamento a venda dele (se tiver). */
export async function removePayment(paymentId: string, userId?: string) {
  const payment = await prisma.orderPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  await undoOrderSale(payment.saleId, userId);
  await prisma.orderPayment.delete({ where: { id: payment.id } });
  await refreshPaid(payment.orderId);
}

/** Valor dos pagamentos desta encomenda que já estão no faturamento. */
async function bookedAmount(orderId: string, db: Tx = prisma) {
  const booked = await db.orderPayment.findMany({ where: { orderId, saleId: { not: null } }, select: { amount: true, saleId: true } });
  // Só conta a venda do pagamento que ainda está valendo (pode ter sido cancelada/excluída em Vendas).
  const alive = new Set(
    (await db.sale.findMany({ where: { id: { in: booked.map((p) => p.saleId!) }, status: "CONFIRMADA" }, select: { id: true } })).map((x) => x.id),
  );
  return booked.filter((p) => alive.has(p.saleId!)).reduce((s, p) => s + Number(p.amount), 0);
}

/** Entrega e recebimento do restante são gravados juntos, sem duplicar faturamento. */
export async function deliverOrder(orderId: string, userId?: string, method: PaymentMethod = "QR") {
  return prisma.$transaction(async (tx) => {
    // Só uma entrega pode assumir a encomenda. Se qualquer gravação falhar, tudo é revertido.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "PENDENTE" },
      data: { status: "ENTREGUE" },
    });
    if (!count) return;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    const missing = Math.max(0, Math.round((Number(order.total) - Number(order.paid)) * 100) / 100);
    // Inclui pagamentos antigos ainda não faturados, sem contar novamente os sinais já faturados.
    const remaining = Math.round((Number(order.total) - (await bookedAmount(order.id, tx))) * 100) / 100;
    let saleId: string | null = null;
    if (remaining > 0) {
      const main = [...order.payments].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      const details = [order.dough && `Massa: ${order.dough}`, order.filling && `Recheio: ${order.filling}`, order.decoration && `Decoração: ${order.decoration}`]
        .filter(Boolean)
        .join(" · ");
      const sale = await createSale({
        items: [{ variantId: await orderVariantId(tx), quantity: 1, unitPrice: remaining, description: `Encomenda #${order.number}: ${productTitle(order.product)}` }],
        channel: order.channel,
        payment: missing > 0 ? method : main?.method ?? method,
        customerName: order.customerName,
        customerPhone: order.customerPhone ?? undefined,
        notes: [details, order.notes].filter(Boolean).join("\n") || undefined,
        userId,
        externalRef: `encomenda:${order.id}`,
      }, tx);
      saleId = sale.id;
    }
    if (missing > 0) {
      await tx.orderPayment.create({ data: { orderId, amount: missing, method, saleId } });
      await refreshPaid(orderId, tx);
    }
    await tx.order.update({ where: { id: orderId }, data: { saleId } });
    await syncOrderStock(tx, orderId, { userId });
    await recordOrderActivity(tx, orderId, "Marcado como entregue", userId);
  });
}

/** Exclusão: tira do faturamento a venda da entrega e as dos pagamentos. */
export async function undoAllOrderSales(orderId: string, userId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) return;
  await undoOrderSale(order.saleId, userId);
  for (const p of order.payments) await undoOrderSale(p.saleId, userId);
}

/** Desfaz uma venda gerada por encomenda (entrega ou pagamento). */
export async function undoOrderSale(saleId: string | null, userId?: string) {
  if (!saleId) return;
  try {
    await cancelSale(saleId, userId);
  } catch (e) {
    if (!(e instanceof InventoryError)) throw e; // já cancelada: nada a fazer
  }
}
