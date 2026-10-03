// Regras de estoque e vendas. Usado pelo painel e, depois, pelo agente do WhatsApp.
import { Prisma, type MovementType, type PaymentMethod, type SaleChannel } from "@prisma/client";
import { prisma } from "./db";
import { variantLabel } from "./format";

export class InventoryError extends Error {}

type Tx = Prisma.TransactionClient;

/** Aplica `delta` ao estoque sem deixar ficar negativo (seguro contra concorrência). */
async function applyDelta(tx: Tx, variantId: string, delta: number, label: string) {
  if (delta < 0) {
    const { count } = await tx.variant.updateMany({
      where: { id: variantId, stock: { gte: -delta } },
      data: { stock: { increment: delta } },
    });
    if (count === 0) {
      const v = await tx.variant.findUnique({ where: { id: variantId } });
      throw new InventoryError(
        `Estoque insuficiente de ${label}: há ${v?.stock ?? 0}, precisa de ${-delta}. ` +
          `Registre a produção em Estoque antes.`,
      );
    }
  } else if (delta > 0) {
    await tx.variant.update({ where: { id: variantId }, data: { stock: { increment: delta } } });
  }
  const v = await tx.variant.findUniqueOrThrow({ where: { id: variantId } });
  return v.stock;
}

export async function moveStock(input: {
  variantId: string;
  type: Extract<MovementType, "ENTRADA" | "SAIDA" | "AJUSTE">;
  /** ENTRADA/SAIDA: quantidade (> 0). AJUSTE: contagem real (>= 0). */
  quantity: number;
  note?: string;
  userId?: string;
}) {
  const { variantId, type, quantity, note, userId } = input;
  if (!Number.isInteger(quantity) || quantity < 0 || (type !== "AJUSTE" && quantity === 0)) {
    throw new InventoryError("Quantidade inválida.");
  }

  return prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant) throw new InventoryError("Produto não encontrado.");
    const label = variantLabel(variant.product.name, variant.name);

    const delta =
      type === "ENTRADA" ? quantity : type === "SAIDA" ? -quantity : quantity - variant.stock;
    if (delta === 0) return variant.stock;

    const stockAfter = await applyDelta(tx, variantId, delta, label);
    await tx.stockMovement.create({
      data: { variantId, type, quantity: delta, stockAfter, note, userId },
    });
    return stockAfter;
  });
}

export type SaleItemInput = {
  variantId: string;
  quantity: number;
  /** Preço negociado (tortas personalizadas). Se omitido, usa o preço cadastrado. */
  unitPrice?: number;
  /** Texto do item na venda. Se omitido, usa o nome do produto e tamanho. */
  description?: string;
};

export async function createSale(input: {
  items: SaleItemInput[];
  channel: SaleChannel;
  payment: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  userId?: string;
  /** Referência externa (ex.: id do aviso do agente). */
  externalRef?: string;
}, transaction?: Tx) {
  const items = input.items.filter((i) => i.quantity > 0);
  if (items.length === 0) throw new InventoryError("Adicione pelo menos um item.");
  for (const i of items) {
    if (!Number.isInteger(i.quantity)) throw new InventoryError("Quantidade inválida.");
    if (i.unitPrice !== undefined && !(i.unitPrice >= 0)) {
      throw new InventoryError("Preço inválido.");
    }
  }

  const run = async (tx: Tx) => {
    const variants = await tx.variant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      include: { product: true },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    const lines = items.map((i) => {
      const v = byId.get(i.variantId);
      if (!v) throw new InventoryError("Produto não encontrado.");
      const unitPrice = i.unitPrice ?? Number(v.price);
      if (v.product.priceOnRequest && !(unitPrice > 0)) {
        throw new InventoryError(`Informe o preço combinado de ${v.product.name}.`);
      }
      return {
        variant: v,
        quantity: i.quantity,
        unitPrice,
        unitCost: Number(v.cost),
        description: i.description ?? variantLabel(v.product.name, v.name),
      };
    });

    const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const totalCost = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0);

    const sale = await tx.sale.create({
      data: {
        channel: input.channel,
        payment: input.payment,
        customerName: input.customerName || null,
        customerPhone: input.customerPhone || null,
        notes: input.notes || null,
        userId: input.userId,
        externalRef: input.externalRef || null,
        total,
        totalCost,
        items: {
          create: lines.map((l) => ({
            variantId: l.variant.id,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            unitCost: l.unitCost,
          })),
        },
      },
    });

    for (const l of lines) {
      // Pronta entrega: exige estoque. Sob encomenda: usa as unidades prontas que houver
      // e o resto é produzido por pedido (nunca bloqueia a venda).
      let take = l.quantity;
      if (!l.variant.product.trackStock) {
        const current = await tx.variant.findUniqueOrThrow({ where: { id: l.variant.id }, select: { stock: true } });
        take = Math.min(current.stock, l.quantity);
        if (take <= 0) continue;
      }
      const stockAfter = await applyDelta(tx, l.variant.id, -take, l.description);
      await tx.stockMovement.create({
        data: {
          variantId: l.variant.id,
          type: "VENDA",
          quantity: -take,
          stockAfter,
          saleId: sale.id,
          note: `Venda #${sale.number}`,
          userId: input.userId,
        },
      });
    }

    return sale;
  };
  return transaction ? run(transaction) : prisma.$transaction(run);
}

/** Cancela a venda e devolve ao estoque o que foi baixado por ela. */
export async function cancelSale(saleId: string, userId?: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.sale.updateMany({
      where: { id: saleId, status: "CONFIRMADA" },
      data: { status: "CANCELADA" },
    });
    if (count === 0) throw new InventoryError("Venda não encontrada ou já cancelada.");

    const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
    const baixas = await tx.stockMovement.findMany({ where: { saleId, type: "VENDA" } });
    for (const m of baixas) {
      const stockAfter = await applyDelta(tx, m.variantId, -m.quantity, "");
      await tx.stockMovement.create({
        data: {
          variantId: m.variantId,
          type: "ESTORNO",
          quantity: -m.quantity,
          stockAfter,
          saleId,
          note: `Cancelamento da venda #${sale.number}`,
          userId,
        },
      });
    }
  });
}
