import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/time";

/** Sugestões da ficha: produtos do cardápio e o que já foi digitado em encomendas anteriores. */
export async function orderFormData() {
  const [products, past] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      select: { dough: true, filling: true, topping: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);
  const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))].slice(0, 30);

  return {
    today: dayKey(new Date()),
    tomorrow: dayKey(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    suggestions: {
      product: products.map((p) => p.name),
      dough: distinct(past.map((o) => o.dough)),
      filling: distinct(past.map((o) => o.filling)),
      topping: distinct(past.map((o) => o.topping)),
    },
  };
}
