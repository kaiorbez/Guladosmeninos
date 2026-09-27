import Link from "next/link";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { RevenueChart } from "@/components/RevenueChart";
import { prisma } from "@/lib/db";
import { CHANNEL_LABEL, bs, dateTime, variantLabel } from "@/lib/format";
import {
  countMissingCosts,
  getDailySeries,
  getLowStock,
  getOverview,
  getSalesByChannel,
  getTopProducts,
} from "@/lib/metrics";
import { startOfMonth } from "@/lib/time";

export default async function VisaoGeral() {
  const month = startOfMonth();
  const [overview, series, top, lowStock, channels, missingCosts, recent] = await Promise.all([
    getOverview(),
    getDailySeries(14),
    getTopProducts(month),
    getLowStock(),
    getSalesByChannel(month),
    countMissingCosts(),
    prisma.sale.findMany({
      where: { status: "CONFIRMADA" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { items: true },
    }),
  ]);

  const m = overview.month;
  const ticket = m.orders ? m.revenue / m.orders : 0;
  const margin = m.revenue ? Math.round((m.profit / m.revenue) * 100) : 0;
  const topMax = Math.max(...top.map((t) => t.revenue), 1);
  const channelTotal = channels.reduce((s, c) => s + c.revenue, 0) || 1;
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/La_Paz" });

  return (
    <>
      <PageHeader title="Visão geral" subtitle={`Números da Gula dos Meninos · ${monthName}`}>
        <Link href="/painel/vendas/nova" className="btn-accent">＋ Registrar venda</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi tone="accent" label="Faturamento hoje" value={bs(overview.today.revenue)} hint={`${overview.today.orders} pedido(s)`} />
        <Kpi label="Últimos 7 dias" value={bs(overview.week.revenue)} hint={`${overview.week.orders} pedido(s)`} />
        <Kpi label="No mês" value={bs(m.revenue)} hint={`${m.orders} pedidos · ticket médio ${bs(ticket)}`} />
        <Kpi
          label="Lucro estimado no mês"
          value={bs(m.profit)}
          hint={missingCosts > 0 ? `⚠ ${missingCosts} item(ns) sem custo cadastrado` : `Margem de ${margin}%`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h2 className="text-xl">Faturamento dos últimos 14 dias</h2>
          <RevenueChart data={series} />
        </section>

        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">O que repor</h2>
            <Link href="/painel/estoque?alerta=1" className="text-xs font-semibold text-dourado-600 hover:underline">Ver estoque →</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-cacau-500">Tudo em dia. Nenhum item abaixo do mínimo. ✓</p>
          ) : (
            <ul className="mt-3 divide-y divide-creme-200">
              {lowStock.slice(0, 8).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/painel/estoque/${v.product.id}`} className="hover:underline">
                    {variantLabel(v.product.name, v.name)}
                  </Link>
                  <span className={`badge ${v.stock === 0 ? "bg-coral-500 text-white" : "bg-dourado-400/30 text-dourado-600"}`}>
                    {v.stock === 0 ? "Zerado" : `${v.stock} / mín. ${v.minStock}`}
                  </span>
                </li>
              ))}
              {lowStock.length > 8 && <li className="pt-2 text-xs text-cacau-400">+ {lowStock.length - 8} outros</li>}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h2 className="text-xl">Mais vendidos no mês</h2>
          {top.length === 0 ? (
            <p className="mt-4 text-sm text-cacau-500">Ainda não há vendas registradas neste mês.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {top.map((t, i) => (
                <li key={t.name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold"><span className="text-dourado-500">{i + 1}.</span> {t.name}</span>
                    <span className="whitespace-nowrap text-cacau-500">{t.quantity} un · <b className="text-cacau-900">{bs(t.revenue)}</b></span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-creme-200">
                    <div className="h-2 rounded-full bg-dourado-400" style={{ width: `${(t.revenue / topMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="text-xl">Vendas por canal</h2>
          {channels.length === 0 ? (
            <p className="mt-4 text-sm text-cacau-500">Sem vendas no mês.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {channels.map((c) => (
                <li key={c.channel}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{CHANNEL_LABEL[c.channel]}</span>
                    <span className="text-cacau-500">{Math.round((c.revenue / channelTotal) * 100)}% · {bs(c.revenue)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-creme-200">
                    <div className="h-2 rounded-full bg-coral-400" style={{ width: `${(c.revenue / channelTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Últimas vendas</h2>
          <Link href="/painel/vendas" className="text-xs font-semibold text-dourado-600 hover:underline">Ver todas →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-cacau-500">Nenhuma venda ainda. Registre a primeira em “Nova venda”.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="table-base">
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap text-cacau-400">#{s.number}</td>
                    <td className="whitespace-nowrap">{dateTime(s.createdAt)}</td>
                    <td className="min-w-[14rem]">{s.items.map((i) => `${i.quantity}× ${i.description}`).join(", ")}</td>
                    <td className="whitespace-nowrap">{CHANNEL_LABEL[s.channel]}</td>
                    <td className="whitespace-nowrap text-right font-semibold">{bs(s.total)}</td>
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
