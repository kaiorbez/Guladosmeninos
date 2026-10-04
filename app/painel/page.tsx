import Link from "next/link";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { ProductPhoto } from "@/components/ProductPhoto";
import { RevenueChart } from "@/components/RevenueChart";
import { prisma } from "@/lib/db";
import { CHANNEL_LABEL, bs, dateTime } from "@/lib/format";
import { getDailySeries, getOverview, getSalesByChannel, getTopProducts } from "@/lib/metrics";
import { dayKey, startOfMonth } from "@/lib/time";

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
      where: { status: "PENDENTE", deliveryDate: { lte: new Date(`${tomorrowKey}T00:00:00Z`) } },
      orderBy: [{ deliveryDate: "asc" }, { deliveryTime: { sort: "asc", nulls: "last" } }, { number: "asc" }],
      take: 12,
    }),
  ]);

  const m = overview.month;
  const ticket = m.orders ? m.revenue / m.orders : 0;
  const topMax = Math.max(...top.map((t) => t.revenue), 1);
  const channelTotal = channels.reduce((s, c) => s + c.revenue, 0) || 1;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/La_Paz" });

  const orderGroups = [
    { key: "atrasadas", label: "Dias anteriores", tone: "text-coral-600", orders: orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) < todayKey) },
    { key: "hoje", label: "Hoje", tone: "text-dourado-600", orders: orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) === todayKey) },
    { key: "amanha", label: "Amanhã", tone: "text-cacau-700", orders: orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) === tomorrowKey) },
  ].filter((group) => group.orders.length > 0);

  return (
    <>
      <PageHeader title="Visão geral" subtitle={today.charAt(0).toUpperCase() + today.slice(1)}>
        <Link href="/painel/vendas/nova" className="btn-accent">＋ Registrar venda</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi tone="accent" label="Faturamento hoje" value={bs(overview.today.revenue)} hint={`${overview.today.orders} pedido(s)`} href="/painel/vendas?periodo=hoje#por-horario" />
        <Kpi label="Últimos 7 dias" value={bs(overview.week.revenue)} hint={`${overview.week.orders} pedido(s)`} href="/painel/vendas?periodo=semana#por-horario" />
        <Kpi label="No mês" value={bs(m.revenue)} hint={`${m.orders} pedido(s)`} href="/painel/vendas?periodo=mes#por-horario" />
        <Kpi label="Ticket médio no mês" value={bs(ticket)} hint="Valor médio por pedido" />
      </div>

      <section className="card mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base">Encomendas para hoje e amanhã</h2>
            <p className="mt-1 text-xs text-cacau-500">Pendentes por dia e horário · toque na encomenda para abrir a ficha</p>
          </div>
          <Link href="/painel/encomendas" className="btn-ghost px-3 py-1.5 text-xs">Ver todas →</Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-4 rounded-lg bg-creme-200/50 px-4 py-5 text-sm text-cacau-500">Nenhuma encomenda pendente para hoje ou amanhã.</p>
        ) : (
          <div className={`mt-5 grid gap-4 ${orderGroups.length > 1 ? "lg:grid-cols-2" : ""} ${orderGroups.length > 2 ? "2xl:grid-cols-3" : ""}`}>
            {orderGroups.map((group) => (
              <section key={group.key} aria-label={`Encomendas: ${group.label}`} className="min-w-0 rounded-xl border border-creme-300 bg-creme-200/30 p-3">
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <h3 className={`text-sm font-semibold ${group.tone}`}>{group.label}</h3>
                  <span className="text-xs text-cacau-500">{group.orders.length} encomenda(s)</span>
                </div>
                <ul className="space-y-2">
                  {group.orders.map((o) => {
                    const missing = Math.max(0, Number(o.total) - Number(o.paid));
                    return (
                      <li key={o.id}>
                        <Link href={`/painel/encomendas/${o.id}`} className="group block rounded-lg border border-creme-300 bg-white p-3 transition-colors hover:border-dourado-400 dark:bg-creme-50">
                          <div className="flex items-start gap-3">
                            <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-creme-200 px-1 py-2 text-center">
                              <span className={`font-semibold tabular-nums ${o.deliveryTime ? "text-base" : "text-xs"}`}>{o.deliveryTime || "Sem horário"}</span>
                              {group.key === "atrasadas" && <span className="mt-1 text-[10px] text-coral-600">{o.deliveryDate.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" })}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-semibold group-hover:text-dourado-600">{o.customerName}</p>
                              <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-xs leading-relaxed text-cacau-500" title={o.product}>{o.product}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-creme-300/60 pt-2">
                            <span className="text-xs text-cacau-500">#{o.number} · Total {bs(o.total)}</span>
                            <span className={`badge text-xs ${missing > 0 ? "bg-coral-500/15 text-coral-600" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>
                              {missing > 0 ? `Falta ${bs(missing)}` : "Pago"}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
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
                      <span className="whitespace-nowrap text-cacau-500">{t.quantity} un · <b className="text-cacau-900">{bs(t.revenue)}</b></span>
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
