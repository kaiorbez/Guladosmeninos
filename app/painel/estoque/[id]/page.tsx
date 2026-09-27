import Link from "next/link";
import { notFound } from "next/navigation";
import { AdjustStock } from "@/components/AdjustStock";
import { PageHeader } from "@/components/PageHeader";
import { ProductForm } from "@/components/ProductForm";
import { prisma, productImage } from "@/lib/db";
import { MOVEMENT_LABEL, bs, dateTime, toNumber } from "@/lib/format";

export default async function ProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { id } = await params;
  const { salvo } = await searchParams;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: { sortOrder: "asc" }, include: { pedidosYa: { orderBy: { sortOrder: "asc" } } } },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!product) notFound();

  const movements = await prisma.stockMovement.findMany({
    where: { variant: { productId: id } },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { variant: true, user: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title={product.name} subtitle={product.category.name}>
        <Link href={`/painel/estoque?categoria=${product.category.slug}`} className="btn-ghost">← Voltar</Link>
      </PageHeader>
      {salvo && <p className="mb-4 rounded-xl bg-creme-200 px-4 py-2 text-sm font-bold text-cacau-900">Produto criado.</p>}

      <ProductForm
        categories={categories}
        initial={{
          id: product.id,
          name: product.name,
          description: product.description ?? "",
          categoryId: product.categoryId,
          trackStock: product.trackStock,
          priceOnRequest: product.priceOnRequest,
          onStore: product.onStore,
          active: product.active,
          image: productImage(product),
          variants: product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            servings: v.servings ?? "",
            price: String(toNumber(v.price)),
            cost: String(toNumber(v.cost)),
            minStock: String(v.minStock),
            active: v.active,
          })),
        }}
      />

      {product.variants.some((v) => v.pedidosYa.length > 0) && (
        <section className="card mt-6">
          <h2 className="text-xl">No PedidosYa</h2>
          <p className="mb-2 text-xs text-cacau-400">Anúncios ligados a este produto. Edite os preços na aba PedidosYa.</p>
          <table className="table-base">
            <tbody>
              {product.variants.flatMap((v) =>
                v.pedidosYa.map((py) => (
                  <tr key={py.id}>
                    <td className="font-bold" data-py-name>{py.name} <span className="text-[11px] uppercase text-[#C8003F]">nome no app</span></td>
                    <td>{v.name}</td>
                    <td className="text-right font-bold">{bs(py.price)}</td>
                    <td className="text-right text-cacau-400">WhatsApp: {product.onStore ? bs(v.price) : "—"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      )}

      {(
        <section className="card mt-6">
          <h2 className="text-xl">{product.trackStock ? "Ajuste de contagem" : "Unidades prontas"}</h2>
          <p className="mb-2 text-sm text-cacau-500">
            {product.trackStock
              ? "Contou o estoque físico? Digite quanto tem de verdade e o sistema corrige."
              : "Produto sob encomenda: informe quantas unidades já estão prontas. A venda usa essas primeiro e nunca é bloqueada."}
          </p>
          <div className="divide-y divide-creme-200">
            {product.variants.filter((v) => v.active).map((v) => (
              <AdjustStock key={v.id} variantId={v.id} label={v.name} current={v.stock} />
            ))}
          </div>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="text-xl">Histórico de estoque</h2>
        {movements.length === 0 ? (
          <p className="mt-3 text-sm text-cacau-500">Nenhuma movimentação ainda.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Quando</th><th>Tamanho</th><th>Tipo</th><th className="text-right">Qtd</th><th className="text-right">Ficou</th><th>Quem / obs.</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{dateTime(m.createdAt)}</td>
                    <td>{m.variant.name}</td>
                    <td>{MOVEMENT_LABEL[m.type]}</td>
                    <td className={`text-right font-bold ${m.quantity > 0 ? "text-dourado-600" : "text-coral-600"}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="text-right">{m.stockAfter}</td>
                    <td className="text-cacau-500">{[m.user?.name, m.note].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
