import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PhotoUpload } from "@/components/PhotoUpload";
import { PriceEdit } from "@/components/PriceEdit";
import { StockControl } from "@/components/StockControl";
import { prisma, productImage } from "@/lib/db";
import { bs, toNumber } from "@/lib/format";

type Search = Promise<{ categoria?: string; q?: string }>;

export default async function EstoquePage({ searchParams }: { searchParams: Search }) {
  const { categoria, q } = await searchParams;

  const categories = await prisma.category.findMany({
    where: categoria ? { slug: categoria } : undefined,
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        // "Encomenda" é o item interno das vendas geradas por encomendas
        where: { AND: [{ name: { not: "Encomenda" } }, q ? { name: { contains: q, mode: "insensitive" } } : {}] },
        orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        include: {
          variants: {
            orderBy: { sortOrder: "asc" },
            include: { pedidosYa: { where: { active: true }, select: { price: true }, orderBy: { price: "asc" } } },
          },
        },
      },
    },
  });

  const visible = categories.filter((cat) => cat.products.length > 0);

  const title = categoria && categories[0] ? categories[0].name : "Estoque";
  const allTracked = categories.flatMap((c) =>
    c.products.filter((p) => p.active && p.trackStock).flatMap((p) => p.variants.filter((v) => v.active)),
  );
  const units = allTracked.reduce((s, v) => s + v.stock, 0);
  const stockValue = allTracked.reduce((s, v) => s + v.stock * toNumber(v.price), 0);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${units} unidades prontas em estoque · ${bs(stockValue)} em valor de venda`}
      >
        <Link href="/painel/estoque/novo" className="btn-primary">＋ Novo produto</Link>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <form action="/painel/estoque" className="flex gap-2">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <input name="q" defaultValue={q} placeholder="Buscar produto..." className="input w-56" />
          <button className="btn-ghost">Buscar</button>
        </form>
        {(categoria || q) && (
          <Link href="/painel/estoque" className="text-sm text-cacau-500 hover:underline">Limpar filtros</Link>
        )}
      </div>

      <div className="mb-5 rounded-lg border border-creme-300 bg-creme-50 px-4 py-3 text-sm text-cacau-700">
        <b>Como usar:</b> digite a quantidade e toque em <b className="text-cacau-900">+</b> quando produzir, ou em{" "}
        <b className="text-coral-600">−</b> para perdas. Nos itens <b>sob encomenda</b>, use o + para informar unidades já
        prontas (a venda usa essas primeiro e nunca é bloqueada). Toque na foto para trocar e no preço (✎) para alterar. As vendas dão baixa sozinhas.
      </div>

      <div className="space-y-2">
        {visible.map(({ products, ...cat }) => {
          return (
            <details key={cat.id} open={Boolean(categoria || q)} className="group/sec [&[open]]:pb-6">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg py-2 hover:text-dourado-600 group-open/sec:mb-3 [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-creme-300 bg-creme-50 text-sm transition-transform group-open/sec:rotate-90">
                  ▶
                </span>
                <span className="text-lg font-semibold">{cat.name}</span>
                <span className="text-sm text-cacau-500">
                  {products.length} produto(s){cat.description ? ` · ${cat.description}` : ""}
                </span>
              </summary>
              <div className="card overflow-x-auto p-0">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="pl-5">Produto</th>
                      <th>Tamanho</th>
                      <th className="text-right">WhatsApp</th>
                      <th className="text-right">PedidosYa</th>
                      <th className="text-center">Estoque</th>
                      <th className="pr-5 text-right">Movimentar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const variants = p.variants;
                      return variants.map((v, i) => (
                        <tr key={v.id} className={!p.active || !v.active ? "opacity-50" : ""}>
                          {i === 0 && (
                            <td rowSpan={variants.length} className="min-w-[17rem] pl-5 align-top">
                              <div className="flex items-start gap-3">
                                <PhotoUpload productId={p.id} src={productImage(p)} name={p.name} size={56} />
                                <div>
                                  <Link href={`/painel/estoque/${p.id}`} className="text-[15px] font-medium hover:text-dourado-600 hover:underline">
                                    {p.name}
                                  </Link>
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {!p.active && <span className="badge bg-cacau-400 text-white">Inativo</span>}
                                    {!p.onStore && <span className="badge bg-pedidosya/10 text-[#C8003F] dark:text-pedidosya">Só no PedidosYa</span>}
                                    {!p.trackStock && <span className="badge bg-creme-200 text-cacau-700">Sob encomenda</span>}
                                    {p.priceOnRequest && <span className="badge bg-dourado-400/20 text-dourado-600">Preço a consultar</span>}
                                  </span>
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="whitespace-nowrap">
                            <span className="font-medium">{v.name}</span>
                            {v.servings && <span className="block text-xs text-cacau-400">{v.servings}</span>}
                          </td>
                          <td className="whitespace-nowrap text-right font-medium">
                            {p.priceOnRequest ? <span className="text-cacau-400">sob consulta</span> : <PriceEdit variantId={v.id} price={toNumber(v.price)} />}
                          </td>
                          <td className="whitespace-nowrap text-right text-cacau-500">
                            {v.pedidosYa.length === 0
                              ? <span className="text-cacau-400">—</span>
                              : v.pedidosYa.length === 1
                                ? bs(v.pedidosYa[0].price)
                                : `${bs(v.pedidosYa[0].price)}+`}
                          </td>
                          <td className="text-center">
                            {p.trackStock ? (
                              <span
                                className="badge bg-creme-200 text-sm text-cacau-900"
                              >
                                {v.stock}
                              </span>
                            ) : v.stock > 0 ? (
                              <span className="badge bg-creme-200 text-sm text-cacau-900" title="Unidades prontas (sob encomenda)">
                                {v.stock} prontas
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-cacau-500">encomenda</span>
                            )}
                          </td>
                          <td className="pr-5">
                            {p.active && v.active && <StockControl variantId={v.id} />}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
        {visible.length === 0 && (
          <p className="card text-sm text-cacau-500">
            Nenhum produto encontrado.
          </p>
        )}
      </div>
    </>
  );
}
