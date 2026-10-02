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

/** Recalcula o total pago a partir dos pagamentos. */
export async function refreshPaid(orderId: string) {
  const { _sum } = await prisma.orderPayment.aggregate({ where: { orderId }, _sum: { amount: true } });
  await prisma.order.update({ where: { id: orderId }, data: { paid: _sum.amount ?? 0 } });
}

export async function addPayment(orderId: string, amount: number, method: PaymentMethod) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("Encomenda não encontrada.");
  if (!(amount > 0)) throw new OrderError("Informe um valor maior que zero.");
  const missing = Number(order.total) - Number(order.paid);
  if (amount > missing + 0.001) throw new OrderError(`Falta receber só Bs ${missing.toLocaleString("pt-BR")}.`);
  await prisma.orderPayment.create({ data: { orderId, amount, method } });
  await refreshPaid(orderId);
}

/** Entrega: registra a venda (entra no faturamento) e marca como entregue. */
export async function deliverOrder(orderId: string, userId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order || order.status !== "PENDENTE") return;

  let saleId: string | null = null;
  if (Number(order.total) > 0) {
    // Forma de pagamento da venda: a que recebeu o maior valor.
    const main = [...order.payments].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    const details = [order.dough && `Massa: ${order.dough}`, order.filling && `Recheio: ${order.filling}`, order.decoration && `Decoração: ${order.decoration}`]
      .filter(Boolean)
      .join(" · ");
    const sale = await createSale({
      items: [{ variantId: await orderVariantId(), quantity: 1, unitPrice: Number(order.total), description: `Encomenda #${order.number}: ${order.product}` }],
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

/** Desfaz a venda gerada na entrega (volta para pendente ou exclusão). */
export async function undoOrderSale(saleId: string | null, userId?: string) {
  if (!saleId) return;
  try {
    await cancelSale(saleId, userId);
  } catch (e) {
    if (!(e instanceof InventoryError)) throw e; // já cancelada: nada a fazer
  }
}
