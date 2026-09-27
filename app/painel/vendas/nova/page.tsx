import { PageHeader } from "@/components/PageHeader";
import { SaleForm, type MenuCategory } from "@/components/SaleForm";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/format";

export default async function NovaVendaPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { variants: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const menu: MenuCategory[] = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      products: c.products
        .filter((p) => p.variants.length > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          trackStock: p.trackStock,
          priceOnRequest: p.priceOnRequest,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            servings: v.servings,
            price: toNumber(v.price),
            stock: v.stock,
          })),
        })),
    }))
    .filter((c) => c.products.length > 0);

  return (
    <>
      <PageHeader title="Nova venda" subtitle="O preço vem do cardápio e o estoque baixa sozinho" />
      <SaleForm menu={menu} />
    </>
  );
}
