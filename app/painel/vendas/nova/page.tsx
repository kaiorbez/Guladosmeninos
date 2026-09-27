import { PageHeader } from "@/components/PageHeader";
import { SaleForm, type MenuProduct, type MenuSection } from "@/components/SaleForm";
import { prisma, productImage } from "@/lib/db";
import { toNumber, variantLabel } from "@/lib/format";

export default async function NovaVendaPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const { canal } = await searchParams;
  const [categories, pyItems] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { active: true, onStore: true },
          orderBy: { sortOrder: "asc" },
          include: { variants: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    prisma.pedidosYaItem.findMany({
      where: { active: true, price: { gt: 0 }, variant: { active: true, product: { active: true } } },
      orderBy: { sortOrder: "asc" },
      include: { variant: { include: { product: true } } },
    }),
  ]);

  // Cardápio da loja: categoria > produto > tamanhos
  const store: MenuSection[] = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      products: c.products
        .filter((p) => p.variants.length > 0)
        .map((p) => {
          const image = productImage(p);
          return {
            id: p.id,
            name: p.name,
            image,
            items: p.variants.map((v) => ({
              key: v.id,
              variantId: v.id,
              label: variantLabel(p.name, v.name),
              size: v.name === "Único" ? null : v.name,
              servings: v.servings,
              price: toNumber(v.price),
              priceOnRequest: p.priceOnRequest,
              trackStock: p.trackStock,
              stock: v.stock,
              image,
            })),
          };
        }),
    }))
    .filter((c) => c.products.length > 0);

  // Cardápio do PedidosYa: seção > anúncio (cada anúncio é um card com o preço do app)
  const pySections = new Map<string, MenuProduct[]>();
  for (const i of pyItems) {
    const p = i.variant.product;
    const image = productImage(p);
    const label = variantLabel(p.name, i.variant.name);
    const list = pySections.get(i.section) ?? [];
    list.push({
      id: i.id,
      name: label,
      appName: i.name,
      image,
      items: [
        {
          key: i.id,
          variantId: i.variantId,
          label,
          size: null,
          servings: i.variant.servings,
          price: toNumber(i.price),
          priceOnRequest: false,
          trackStock: p.trackStock,
          stock: i.variant.stock,
          image,
        },
      ],
    });
    pySections.set(i.section, list);
  }
  const pedidosYa: MenuSection[] = [...pySections.entries()].map(([name, products]) => ({ id: `py-${name}`, name, products }));

  return (
    <>
      <PageHeader title="Nova venda" subtitle="O preço vem do cardápio e o estoque baixa sozinho" />
      <SaleForm store={store} pedidosYa={pedidosYa} initialChannel={canal === "PEDIDOSYA" ? "PEDIDOSYA" : "BALCAO"} />
    </>
  );
}
