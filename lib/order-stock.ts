// Baixa de estoque das encomendas.
// Regra da loja (26/10/2026): o estoque sai quando o pagamento é confirmado.
// - Encomenda para hoje (ou atrasada) com algum pagamento confirmado: baixa os itens.
// - Encomenda futura já paga: baixa quando chegar o dia de entrega (na entrega, no mínimo).
// - Entregue: sempre baixada. Cancelada ou excluída: o que foi baixado volta ao estoque.
// Nunca bloqueia pagamento/entrega: se faltar unidade, baixa só o que há (sem estoque negativo).
// As movimentações ficam no histórico de Estoque com a referência "encomenda:<id>".
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;
type Line = { variantId?: string; descricao?: string; quantidade?: number };

const ORDER_PRODUCT = "Encomenda";

export const orderStockRef = (orderId: string) => `encomenda:${orderId}`;

/** Dia de hoje em La Paz (UTC-4), "YYYY-MM-DD". */
export function todayLaPaz(now = new Date()) {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const norm = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\btamanho\b|\btamano\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** A encomenda deve estar baixada do estoque agora? */
export function shouldDeduct(
  o: { status: string; paid: unknown; deliveryDate: Date },
  now = new Date(),
) {
  if (o.status === "CANCELADA") return false;
  if (o.status === "ENTREGUE") return true;
  return Number(o.paid) > 0 && o.deliveryDate.toISOString().slice(0, 10) <= todayLaPaz(now);
}

/** Quantidade por variante dos itens da encomenda (variantId gravado ou nome exato do cardápio). */
export async function orderVariantQuantities(tx: Tx, items: unknown) {
  const lines = (Array.isArray(items) ? items : []) as Line[];
  const wanted = new Map<string, number>();
  if (!lines.length) return wanted;
  let byLabel: Map<string, string[]> | null = null;
  const ids = new Set(
    (await tx.variant.findMany({
      where: { id: { in: lines.map((l) => String(l?.variantId || "")).filter(Boolean) } },
      select: { id: true },
    })).map((v) => v.id),
  );
  for (const l of lines) {
    const qty = Number(l?.quantidade);
    if (!Number.isInteger(qty) || qty <= 0) continue;
    let id = l?.variantId && ids.has(String(l.variantId)) ? String(l.variantId) : null;
    if (!id && l?.descricao) {
      if (!byLabel) {
        byLabel = new Map();
        const variants = await tx.variant.findMany({
          where: { product: { name: { not: ORDER_PRODUCT } } },
          select: { id: true, name: true, product: { select: { name: true } } },
        });
        for (const v of variants) {
          const labels = new Set([
            v.name === "Único" ? v.product.name : `${v.product.name} ${v.name}`,
            `${v.product.name} (${v.name})`,
          ]);
          for (const label of labels) {
            const k = norm(label);
            byLabel.set(k, [...(byLabel.get(k) || []), v.id]);
          }
        }
      }
      const match = byLabel.get(norm(l.descricao)) || [];
      // Nome ambíguo ou fora do cardápio: não adivinha.
      if (new Set(match).size === 1) id = match[0];
    }
    if (id) wanted.set(id, (wanted.get(id) || 0) + qty);
  }
  return wanted;
}

/**
 * Deixa o estoque coerente com a situação da encomenda. Idempotente: compara o que deveria estar
 * baixado com o que já foi baixado (movimentações "encomenda:<id>") e aplica só a diferença.
 */
export async function syncOrderStock(tx: Tx, orderId: string, opts: { release?: boolean; userId?: string; now?: Date } = {}) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, motivo: "Encomenda não encontrada." };
  const ref = orderStockRef(orderId);
  const target = !opts.release && shouldDeduct(order, opts.now) ? await orderVariantQuantities(tx, order.agentItems) : new Map<string, number>();
  const moves = await tx.stockMovement.findMany({ where: { saleId: ref }, select: { variantId: true, quantity: true } });
  const applied = new Map<string, number>();
  for (const m of moves) applied.set(m.variantId, (applied.get(m.variantId) || 0) - m.quantity); // unidades baixadas
  const changes: { variantId: string; quantity: number }[] = [];
  for (const variantId of new Set([...target.keys(), ...applied.keys()])) {
    const want = target.get(variantId) || 0;
    const have = applied.get(variantId) || 0;
    if (want === have) continue;
    if (want > have) {
      // Baixa: só o que existe (nunca negativo, nunca trava pagamento/entrega).
      const v = await tx.variant.findUnique({ where: { id: variantId }, select: { stock: true } });
      const take = Math.min(Math.max(0, v?.stock ?? 0), want - have);
      if (take <= 0) continue;
      const { count } = await tx.variant.updateMany({ where: { id: variantId, stock: { gte: take } }, data: { stock: { increment: -take } } });
      if (!count) continue;
      const after = await tx.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
      await tx.stockMovement.create({
        data: { variantId, type: "VENDA", quantity: -take, stockAfter: after.stock, saleId: ref, note: `Encomenda #${order.number}`, userId: opts.userId },
      });
      changes.push({ variantId, quantity: -take });
    } else {
      // Devolução: encomenda cancelada/excluída, voltou a pendente sem pagamento ou teve item reduzido.
      const back = have - want;
      await tx.variant.update({ where: { id: variantId }, data: { stock: { increment: back } } });
      const after = await tx.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
      await tx.stockMovement.create({
        data: { variantId, type: "ESTORNO", quantity: back, stockAfter: after.stock, saleId: ref, note: `Devolução da encomenda #${order.number}`, userId: opts.userId },
      });
      changes.push({ variantId, quantity: back });
    }
  }
  return { ok: true, changes };
}
