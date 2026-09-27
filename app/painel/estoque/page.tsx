import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ProductPhoto } from "@/components/ProductPhoto";
import { StockControl } from "@/components/StockControl";
import { prisma, productImage } from "@/lib/db";
import { bs, toNumber } from "@/lib/format";

type Search = Promise<{ categoria?: string; alerta?: string; q?: string }>;

export default async function EstoquePage({ searchParams }: { searchParams: Search }) {
  const { categoria, alerta, q } = await searchParams;

  const categories = await prisma.category.findMany({
    where: categoria ? { slug: categoria } : undefined,
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
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

  const onlyAlerts = alerta === "1";
  const needsAttention = (v: { stock: number; minStock: number; active: boolean }) =>
    v.active && (v.stock === 0 || v.stock <= v.minStock);

  const visible = categories
    .map((cat) => ({
      ...cat,
      products: cat.products.filter(
        (p) => !onlyAlerts || (p.active && p.trackStock && p.variants.some(needsAttention)),
      ),
    }))
    .filter((cat) => cat.products.length > 0);

  const title = categoria && categories[0] ? categories[0].name : "Estoque";
  const allTracked = categories.flatMap((c) =>
    c.products.filter((p) => p.active && p.trackStock).flatMap((p) => p.variants.filter((v) => v.active)),
  );
  const units = allTracked.reduce((s, v) => s + v.stock, 0);
  const stockValue = allTracked.reduce((s, v) => s + v.stock * toNumber(v.price), 0);

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { categoria, q, alerta, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/painel/estoque?${s}` : "/painel/estoque";
  };

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
          {alerta && <input type="hidden" name="alerta" value={alerta} />}
          <input name="q" defaultValue={q} placeholder="Buscar produto..." className="input w-56" />
          <button className="btn-ghost">Buscar</button>
        </form>
        <Link
          href={qs({ alerta: onlyAlerts ? undefined : "1" })}
          className={`btn ${onlyAlerts ? "bg-coral-500 text-white" : "btn-ghost"}`}
        >
          ⚠ Só o que precisa repor
        </Link>
        {(categoria || q || alerta) && (
          <Link href="/painel/estoque" className="text-sm text-cacau-500 hover:underline">Limpar filtros</Link>
        )}
      </div>

      <div className="mb-5 rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-xs text-cacau-500">
        <b>Como usar:</b> digite a quantidade e toque em <b className="text-cacau-900">+</b> quando produzir, ou em{" "}
        <b className="text-coral-600">−</b> para perdas (vencido, quebrou, degustação). As vendas dão baixa sozinhas.
        Para corrigir uma contagem, abra o produto e use <b>Ajuste de contagem</b>.
      </div>

      <div className="space-y-8">
        {visible.map(({ products, ...cat }) => {
          return (
            <section key={cat.id}>
              {!categoria && (
                <h2 className="mb-3 text-2xl">
                  {cat.name}
                  {cat.description && <span className="ml-3 font-sans text-sm font-normal text-cacau-400">{cat.description}</span>}
                </h2>
              )}
              <div className="card overflow-x-auto p-0">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="pl-5">Produto</th>
                      <th>Tamanho</th>
                      <th className="text-right">Loja</th>
                      <th className="text-right">PedidosYa</th>
                      <th className="text-right">Custo</th>
                      <th className="text-center">Estoque</th>
                      <th className="pr-5 text-right">Movimentar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const variants = p.variants.filter((v) => !onlyAlerts || needsAttention(v));
                      return variants.map((v, i) => (
                        <tr key={v.id} className={!p.active || !v.active ? "opacity-50" : ""}>
                          {i === 0 && (
                            <td rowSpan={variants.length} className="min-w-[17rem] pl-5 align-top">
                              <Link href={`/painel/estoque/${p.id}`} className="group flex items-start gap-3">
                                <ProductPhoto src={productImage(p)} name={p.name} size={56} />
                                <span>
                                  <span className="font-bold group-hover:text-dourado-600 group-hover:underline">{p.name}</span>
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {!p.active && <span className="badge bg-cacau-400 text-creme-100">Inativo</span>}
                                    {!p.onStore && <span className="badge bg-pedidosya/20 text-[#FF6B98]">Só no PedidosYa</span>}
                                    {!p.trackStock && <span className="badge bg-creme-200 text-cacau-500">Sob encomenda</span>}
                                    {p.priceOnRequest && <span className="badge bg-dourado-400/20 text-dourado-600">Preço a consultar</span>}
                                  </span>
                                </span>
                              </Link>
                            </td>
                          )}
                          <td className="whitespace-nowrap">
                            <span className="font-bold">{v.name}</span>
                            {v.servings && <span className="block text-xs text-cacau-400">{v.servings}</span>}
                          </td>
                          <td className="whitespace-nowrap text-right font-bold">
                            {p.priceOnRequest || !p.onStore ? <span className="text-cacau-400">—</span> : bs(v.price)}
                          </td>
                          <td className="whitespace-nowrap text-right text-cacau-500">
                            {v.pedidosYa.length === 0
                              ? <span className="text-cacau-400">—</span>
                              : v.pedidosYa.length === 1
                                ? bs(v.pedidosYa[0].price)
                                : `${bs(v.pedidosYa[0].price)}+`}
                          </td>
                          <td className="whitespace-nowrap text-right text-cacau-500">
                            {toNumber(v.cost) > 0 ? bs(v.cost) : <span className="text-xs text-cacau-400">definir</span>}
                          </td>
                          <td className="text-center">
                            {p.trackStock ? (
                              <span
                                className={`badge text-sm ${
                                  v.stock === 0
                                    ? "bg-coral-500 text-white"
                                    : v.stock <= v.minStock
                                      ? "bg-dourado-400/40 text-dourado-600"
                                      : "bg-creme-200 text-cacau-700"
                                }`}
                                title={v.minStock ? `Mínimo: ${v.minStock}` : undefined}
                              >
                                {v.stock}
                              </span>
                            ) : (
                              <span className="text-xs text-cacau-400">—</span>
                            )}
                          </td>
                          <td className="pr-5">
                            {p.trackStock && p.active && v.active ? (
                              <StockControl variantId={v.id} />
                            ) : (
                              <span className="block text-right text-xs text-cacau-400">
                                {p.trackStock ? "" : "feito por pedido"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        {visible.length === 0 && (
          <p className="card text-sm text-cacau-500">
            {onlyAlerts ? "Nada para repor aqui. ✓" : "Nenhum produto encontrado."}
          </p>
        )}
      </div>
    </>
  );
}
