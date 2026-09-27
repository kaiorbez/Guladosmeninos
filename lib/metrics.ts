import { prisma, productImage } from "./db";
import { dayKey, startOfDay, startOfMonth } from "./time";

const confirmed = { status: "CONFIRMADA" as const };

async function totals(from: Date) {
  const agg = await prisma.sale.aggregate({
    where: { ...confirmed, createdAt: { gte: from } },
    _sum: { total: true, totalCost: true },
    _count: true,
  });
  const revenue = Number(agg._sum.total ?? 0);
  const cost = Number(agg._sum.totalCost ?? 0);
  return { revenue, cost, profit: revenue - cost, orders: agg._count };
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

/** Itens com estoque controlado zerados ou no mínimo definido (ou abaixo dele). */
export async function getLowStock() {
  const variants = await prisma.variant.findMany({
    where: { active: true, product: { active: true, trackStock: true } },
    include: { product: { select: { id: true, name: true } } },
    orderBy: { stock: "asc" },
  });
  return variants.filter((v) => v.stock === 0 || v.stock <= v.minStock);
}

/** Quantos itens ainda estão sem custo cadastrado (o lucro fica superestimado). */
export async function countMissingCosts() {
  return prisma.variant.count({
    where: { active: true, cost: 0, product: { active: true, priceOnRequest: false } },
  });
}
