import Link from "next/link";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { ProductPhoto } from "@/components/ProductPhoto";
import { RevenueChart } from "@/components/RevenueChart";
import { prisma } from "@/lib/db";
import { CHANNEL_LABEL, bs, dateTime, variantLabel } from "@/lib/format";
import { getDailySeries, getOverview, getSalesByChannel, getTopProducts } from "@/lib/metrics";
import { dayKey, startOfMonth } from "@/lib/time";
import { NOT_UNPAID_AI } from "@/lib/orders";

export default async function VisaoGeral() {
  const month = startOfMonth();
  const todayKey = dayKey(new Date());
  const tomorrowKey = dayKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [overview, series, top, channels, recent, orders] = await Promise.all([
    getOverview(),
    getDailySeries(14),
    getTopProducts(month),
    getSalesByChannel(month),
    prisma.sale.findMany({
      where: { status: "CONFIRMADA" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { items: true },
    }),
    // Pendentes até amanhã (inclui as atrasadas)
    prisma.order.findMany({
      where: { status: "PENDENTE", deliveryDate: { lte: new Date(`${tomorrowKey}T00:00:00Z`) }, ...NOT_UNPAID_AI },
      orderBy: [{ deliveryDate: "asc" }, { deliveryTime: "asc" }],
      take: 12,
    }),
  ]);

  const m = overview.month;
  const ticket = m.orders ? m.revenue / m.orders : 0;
  const topMax = Math.max(...top.map((t) => t.revenue), 1);
  const channelTotal = channels.reduce((s, c) => s + c.revenue, 0) || 1;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/La_Paz" });

  return (
    <>
      <PageHeader title="Visão geral" subtitle={today.charAt(0).toUpperCase() + today.slice(1)}>
        <Link href="/painel/vendas/nova" className="btn-accent">＋ Registrar venda</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi tone="accent" label="Faturamento hoje" value={bs(overview.today.revenue)} hint={`${overview.today.orders} pedido(s)`} href="/painel/vendas?periodo=hoje#por-cliente" />
        <Kpi label="Últimos 7 dias" value={bs(overview.week.revenue)} hint={`${overview.week.orders} pedido(s)`} href="/painel/vendas?periodo=semana#por-cliente" />
        <Kpi label="No mês" value={bs(m.revenue)} hint={`${m.orders} pedido(s)`} href="/painel/vendas?periodo=mes#por-cliente" />
        <Kpi label="Ticket médio no mês" value={bs(ticket)} hint="Valor médio por pedido" />
      </div>

      <section className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base">Encomendas para hoje e amanhã</h2>
          <Link href="/painel/encomendas" className="text-xs font-medium text-dourado-600 hover:underline">Ver todas →</Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-cacau-500">Nenhuma encomenda pendente para hoje ou amanhã.</p>
        ) : (
          <ul className="mt-2 divide-y divide-creme-300/60 text-sm">
            {orders.map((o) => {
              const k = o.deliveryDate.toISOString().slice(0, 10);
              const missing = Number(o.total) - Number(o.paid);
              return (
                <li key={o.id}>
                  <Link href={`/painel/encomendas/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:text-dourado-600">
                    <span className={`badge ${k < todayKey ? "bg-coral-500 text-white" : k === todayKey ? "bg-dourado-400/25 text-dourado-600" : "bg-creme-200 text-cacau-700"}`}>
                      {k < todayKey ? "Atrasada" : k === todayKey ? "Hoje" : "Amanhã"}
                    </span>
                    <span className="w-12 tabular-nums text-cacau-500">{o.deliveryTime ?? "—"}</span>
                    <span className="font-medium">{o.customerName}</span>
                    <span className="min-w-0 flex-1 truncate text-cacau-500">{o.product}</span>
                    {missing > 0 && <span className="text-coral-600">falta {bs(missing)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h2 className="text-base">Faturamento dos últimos 14 dias</h2>
          <RevenueChart data={series} />
        </section>

        <section className="card">
          <h2 className="text-base">Vendas por canal</h2>
          {channels.length === 0 ? (
            <p className="mt-4 text-sm text-cacau-500">Sem vendas no mês.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {channels.map((c) => (
                <li key={c.channel}>
                  <div className="flex justify-between">
                    <span className="font-medium">{CHANNEL_LABEL[c.channel]}</span>
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

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-3">
          <h2 className="text-base">Mais vendidos no mês</h2>
          <p className="mt-1 text-xs text-cacau-500">Por valor recebido. Encomendas agrupadas pela descrição, contadas uma vez no período.</p>
          {top.length === 0 ? (
            <p className="mt-4 text-sm text-cacau-500">Ainda não há vendas registradas neste mês.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {top.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3">
                  <ProductPhoto src={t.image} name={t.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium"><span className="text-dourado-500">{i + 1}.</span> {t.name}</span>
                      <span className="whitespace-nowrap text-cacau-500">{t.quantity} {t.unit} · <b className="text-cacau-900">{bs(t.revenue)}</b></span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-creme-200">
                      <div className="h-2 rounded-full bg-dourado-400" style={{ width: `${(t.revenue / topMax) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>


      </div>

      <section className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base">Últimas vendas</h2>
          <Link href="/painel/vendas" className="text-xs font-medium text-dourado-600 hover:underline">Ver todas →</Link>
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
                    <td className="whitespace-nowrap text-right font-medium">{bs(s.total)}</td>
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
