// Regras das encomendas: pagamentos e a venda gerada na entrega.
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "./db";
import { InventoryError, cancelSale, createSale } from "./inventory";

export class OrderError extends Error {}

const ORDER_PRODUCT = "Encomenda";

/**
 * Item usado nas vendas geradas por encomendas (o produto da ficha é texto livre).
 * Fica inativo: não aparece no cardápio do agente nem na tela de venda.
 */
async function orderVariantId() {
  const existing = await prisma.variant.findFirst({ where: { name: "Sob consulta", product: { name: ORDER_PRODUCT } } });
  if (existing) return existing.id;
  const category =
    (await prisma.category.findUnique({ where: { slug: "personalizadas" } })) ??
    (await prisma.category.findFirstOrThrow({ orderBy: { sortOrder: "desc" } }));
  const product = await prisma.product.create({
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

/** Encomendas pendentes atrasadas (para o aviso no topo do painel). */
export async function lateOrders() {
  const { day } = nowLaPaz();
  const pending = await prisma.order.findMany({
    where: { status: "PENDENTE", deliveryDate: { lte: new Date(`${day}T00:00:00Z`) } },
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
export async function refreshPaid(orderId: string) {
  const { _sum } = await prisma.orderPayment.aggregate({ where: { orderId }, _sum: { amount: true } });
  await prisma.order.update({ where: { id: orderId }, data: { paid: _sum.amount ?? 0 } });
}

/** Primeira linha dos produtos, para a descrição da venda. */
const productTitle = (product: string) => product.split("\n")[0].trim().slice(0, 80);

/**
 * Leva um pagamento ao faturamento no dia em que foi recebido: cria uma venda com o valor
 * pago e liga ao pagamento. Na entrega entra só o que ainda faltava faturar.
 */
export async function bookPayment(paymentId: string, userId?: string) {
  const payment = await prisma.orderPayment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || payment.saleId) return;
  const o = payment.order;
  const sale = await createSale({
    items: [
      {
        variantId: await orderVariantId(),
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
  });
  await prisma.orderPayment.update({ where: { id: payment.id }, data: { saleId: sale.id } });
}

export async function addPayment(orderId: string, amount: number, method: PaymentMethod, userId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("Encomenda não encontrada.");
  if (!(amount > 0)) throw new OrderError("Informe um valor maior que zero.");
  const missing = Number(order.total) - Number(order.paid);
  if (amount > missing + 0.001) throw new OrderError(`Falta receber só Bs ${missing.toLocaleString("pt-BR")}.`);
  const payment = await prisma.orderPayment.create({ data: { orderId, amount, method } });
  await refreshPaid(orderId);
  // Encomenda já entregue: o valor já entrou no faturamento pela venda da entrega.
  if (order.status !== "ENTREGUE") await bookPayment(payment.id, userId);
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
async function bookedAmount(orderId: string) {
  const booked = await prisma.orderPayment.findMany({ where: { orderId, saleId: { not: null } }, select: { amount: true, saleId: true } });
  // Só conta a venda do pagamento que ainda está valendo (pode ter sido cancelada/excluída em Vendas).
  const alive = new Set(
    (await prisma.sale.findMany({ where: { id: { in: booked.map((p) => p.saleId!) }, status: "CONFIRMADA" }, select: { id: true } })).map((x) => x.id),
  );
  return booked.filter((p) => alive.has(p.saleId!)).reduce((s, p) => s + Number(p.amount), 0);
}

/** Entrega: registra a venda (entra no faturamento) e marca como entregue. */
export async function deliverOrder(orderId: string, userId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order || order.status !== "PENDENTE") return;

  let saleId: string | null = null;
  // Só o que ainda não entrou no faturamento pelos pagamentos registrados.
  const remaining = Math.round((Number(order.total) - (await bookedAmount(order.id))) * 100) / 100;
  if (remaining > 0) {
    // Forma de pagamento da venda: a que recebeu o maior valor.
    const main = [...order.payments].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    const details = [order.dough && `Massa: ${order.dough}`, order.filling && `Recheio: ${order.filling}`, order.decoration && `Decoração: ${order.decoration}`]
      .filter(Boolean)
      .join(" · ");
    const sale = await createSale({
      items: [{ variantId: await orderVariantId(), quantity: 1, unitPrice: remaining, description: `Encomenda #${order.number}: ${productTitle(order.product)}` }],
      channel: order.channel,
      payment: main?.method ?? "QR",
      customerName: order.customerName,
      customerPhone: order.customerPhone ?? undefined,
      notes: [details, order.notes].filter(Boolean).join("\n") || undefined,
      userId,
      externalRef: `encomenda:${order.id}`,
    });
    saleId = sale.id;
  }
  await prisma.order.update({ where: { id: orderId }, data: { status: "ENTREGUE", saleId } });
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
