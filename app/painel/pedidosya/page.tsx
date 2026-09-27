import Link from "next/link";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { ProductPhoto } from "@/components/ProductPhoto";
import { prisma, productImage } from "@/lib/db";
import { bs, toNumber, variantLabel } from "@/lib/format";
import { startOfMonth } from "@/lib/time";
import { PyPriceForm } from "./PyRow";

export default async function PedidosYaPage() {
  const month = startOfMonth();
  const [items, storeProducts, pySales, allSales] = await Promise.all([
    prisma.pedidosYaItem.findMany({
      orderBy: { sortOrder: "asc" },
      include: { variant: { include: { product: true } } },
    }),
    prisma.product.findMany({
      where: { active: true, onStore: true, priceOnRequest: false },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: true, variants: { where: { active: true }, include: { pedidosYa: { select: { id: true } } } } },
    }),
    prisma.sale.aggregate({
      where: { status: "CONFIRMADA", channel: "PEDIDOSYA", createdAt: { gte: month } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { status: "CONFIRMADA", createdAt: { gte: month } },
      _sum: { total: true },
    }),
  ]);

  const active = items.filter((i) => i.active);

  // Diferença de preço PedidosYa × loja (só onde existe preço de loja)
  const compared = active
    .filter((i) => i.variant.product.onStore && !i.variant.product.priceOnRequest && toNumber(i.variant.price) > 0 && toNumber(i.price) > 0)
    .map((i) => ({ item: i, diff: toNumber(i.price) / toNumber(i.variant.price) - 1 }));
  const avgDiff = compared.length ? compared.reduce((s, c) => s + c.diff, 0) / compared.length : 0;

  // Análise
  const missingOnApp = storeProducts.filter((p) => p.variants.every((v) => v.pedidosYa.length === 0));
  const onlyOnApp = [...new Map(active.filter((i) => !i.variant.product.onStore).map((i) => [i.variant.product.id, i.variant.product])).values()];
  const byVariant = new Map<string, typeof active>();
  for (const i of active) byVariant.set(i.variantId, [...(byVariant.get(i.variantId) ?? []), i]);
  const duplicated = [...byVariant.values()].filter((list) => list.length > 1);
  const review = items.filter((i) => i.needsReview);

  const sections = items.reduce<Record<string, typeof items>>((acc, i) => {
    (acc[i.section] ??= []).push(i);
    return acc;
  }, {});

  const share = toNumber(allSales._sum.total ?? 0) ? toNumber(pySales._sum.total ?? 0) / toNumber(allSales._sum.total ?? 0) : 0;

  return (
    <>
      <PageHeader title="PedidosYa" subtitle="Cardápio do app com preços próprios (mais altos por causa da taxa)">
        <Link href="/painel/vendas/nova?canal=PEDIDOSYA" className="btn bg-pedidosya text-white hover:bg-pedidosya/85">＋ Venda PedidosYa</Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi tone="accent" label="Vendido no PedidosYa (mês)" value={bs(pySales._sum.total ?? 0)} hint={`${pySales._count} pedido(s) · ${Math.round(share * 100)}% do faturamento`} />
        <Kpi label="Anúncios ativos" value={String(active.length)} hint={`${Object.keys(sections).length} seções no app`} />
        <Kpi label="Diferença média de preço" value={`${avgDiff >= 0 ? "+" : ""}${Math.round(avgDiff * 100)}%`} hint={`PedidosYa × WhatsApp em ${compared.length} itens`} />
      </div>

      <h2 className="mb-3 mt-8 text-2xl">Análise</h2>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <section className="card">
          <h3 className="text-base">🛒 No WhatsApp, mas fora do PedidosYa</h3>
          <p className="mb-2 text-sm text-cacau-500">Oportunidade: produtos vendidos no WhatsApp que ainda não estão anunciados no app.</p>
          {missingOnApp.length === 0 ? <p className="text-sm text-cacau-500">Todo o cardápio está no app. ✓</p> : (
            <ul className="space-y-1 text-sm">
              {missingOnApp.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={`/painel/estoque/${p.id}`} className="hover:underline">{p.name}</Link>
                  <span className="text-xs text-cacau-400">{p.category.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="text-base">📱 Só no PedidosYa</h3>
          <p className="mb-2 text-sm text-cacau-500">Não são vendidos no WhatsApp. Para vender, defina o preço e marque “Vende no WhatsApp” no produto.</p>
          {onlyOnApp.length === 0 ? <p className="text-sm text-cacau-500">Nenhum. ✓</p> : (
            <ul className="space-y-1 text-sm">
              {onlyOnApp.map((p) => (
                <li key={p.id}><Link href={`/painel/estoque/${p.id}`} className="hover:underline">{p.name}</Link></li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="text-base">🔁 Anúncios repetidos</h3>
          <p className="mb-2 text-sm text-cacau-500">O mesmo produto anunciado mais de uma vez, às vezes com preços diferentes.</p>
          {duplicated.length === 0 ? <p className="text-sm text-cacau-500">Nenhum. ✓</p> : (
            <ul className="space-y-3 text-sm">
              {duplicated.map((list) => (
                <li key={list[0].variantId}>
                  <p className="font-bold">{variantLabel(list[0].variant.product.name, list[0].variant.name)}</p>
                  <p className="text-xs text-cacau-500" data-py-name>{list.map((i) => `“${i.name}” ${bs(i.price)}`).join(" · ")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="text-base">💰 Maiores diferenças de preço</h3>
          <p className="mb-2 text-sm text-cacau-500">Quanto o app cobra a mais que o WhatsApp.</p>
          {compared.length === 0 ? <p className="text-sm text-cacau-500">Sem itens para comparar.</p> : (
            <ul className="space-y-1 text-sm">
              {[...compared].sort((a, b) => b.diff - a.diff).slice(0, 8).map(({ item, diff }) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span>{variantLabel(item.variant.product.name, item.variant.name)}</span>
                  <span className="whitespace-nowrap font-bold text-dourado-600">{bs(item.variant.price)} → {bs(item.price)} ({diff >= 0 ? "+" : ""}{Math.round(diff * 100)}%)</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="text-base">🔎 Preços para conferir</h3>
          <p className="mb-2 text-sm text-cacau-500">Lidos de um print com pouca resolução. Confira no app e salve abaixo.</p>
          {review.length === 0 ? <p className="text-sm text-cacau-500">Tudo conferido. ✓</p> : (
            <ul className="space-y-1 text-sm">
              {review.map((i) => (
                <li key={i.id} className="flex justify-between gap-2"><span data-py-name>{i.name}</span><span className="font-bold">{toNumber(i.price) ? bs(i.price) : "sem preço"}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <h2 className="mb-3 mt-10 text-2xl">Cardápio no app</h2>
      <div className="space-y-6">
        {Object.entries(sections).map(([section, list]) => (
          <details key={section} open className="group/sec">
            <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-creme-300 bg-white text-xs transition-transform group-open/sec:rotate-90">▶</span>
              <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-dourado-600">{section}</span>
              <span className="text-xs text-cacau-500">{list.length} anúncio(s)</span>
            </summary>
            <div className="card overflow-x-auto p-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="pl-5">Anúncio no app</th>
                    <th>Produto no painel</th>
                    <th className="text-right">WhatsApp</th>
                    <th className="text-right">Dif.</th>
                    <th className="text-center">Estoque</th>
                    <th className="pr-5 text-right">Preço no PedidosYa (Bs)</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => {
                    const p = i.variant.product;
                    const store = p.onStore && !p.priceOnRequest ? toNumber(i.variant.price) : 0;
                    const diff = store > 0 && toNumber(i.price) > 0 ? toNumber(i.price) / store - 1 : null;
                    return (
                      <tr key={i.id} className={i.active ? "" : "opacity-50"}>
                        <td className="min-w-[16rem] pl-5">
                          <div className="flex items-center gap-3">
                            <ProductPhoto src={productImage(p)} name={p.name} size={44} />
                            <div>
                              <p className="font-bold" data-py-name>{i.name}</p>
                              <p className="text-[11px] font-bold uppercase tracking-wide text-[#C8003F]">nome no app</p>
                              {i.needsReview && <span className="badge bg-dourado-400/20 text-dourado-600">conferir preço</span>}
                              {toNumber(i.listPrice ?? 0) > 0 && (
                                <span className="ml-1 text-xs text-cacau-400">de <s>{bs(i.listPrice!)}</s></span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="min-w-[12rem]">
                          <Link href={`/painel/estoque/${p.id}`} className="hover:underline">{variantLabel(p.name, i.variant.name)}</Link>
                        </td>
                        <td className="whitespace-nowrap text-right">{store > 0 ? bs(store) : <span className="text-cacau-400">—</span>}</td>
                        <td className="whitespace-nowrap text-right font-bold text-dourado-600">
                          {diff === null ? <span className="font-medium text-cacau-400">—</span> : `${diff >= 0 ? "+" : ""}${Math.round(diff * 100)}%`}
                        </td>
                        <td className="text-center">
                          {p.trackStock ? (
                            <span className={`badge ${i.variant.stock === 0 ? "bg-coral-500 text-white" : "bg-creme-200 text-cacau-700"}`}>{i.variant.stock}</span>
                          ) : (
                            <span className="text-xs text-cacau-400">encomenda</span>
                          )}
                        </td>
                        <td className="pr-5">
                          <PyPriceForm id={i.id} price={toNumber(i.price)} listPrice={i.listPrice ? toNumber(i.listPrice) : null} active={i.active} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
