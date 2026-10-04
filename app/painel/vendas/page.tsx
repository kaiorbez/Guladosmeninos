import Link from "next/link";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { CHANNEL_LABEL, PAYMENT_LABEL, bs, dateTime } from "@/lib/format";
import { getOverview } from "@/lib/metrics";
import { dayKey, startOfDay, startOfMonth } from "@/lib/time";
import { cancelSaleAction, deleteSaleAction } from "./actions";

const PERIODS = {
  hoje: { label: "Hoje", from: () => startOfDay(0) },
  semana: { label: "7 dias", from: () => startOfDay(6) },
  mes: { label: "Este mês", from: () => startOfMonth() },
  "30d": { label: "30 dias", from: () => startOfDay(29) },
  tudo: { label: "Tudo", from: () => new Date(0) },
} as const;
type Period = keyof typeof PERIODS;

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; registrada?: string }>;
}) {
  const sp = await searchParams;
  const periodo: Period = sp.periodo && sp.periodo in PERIODS ? (sp.periodo as Period) : "mes";
  const from = PERIODS[periodo].from();

  const [overview, sales, inPeriod] = await Promise.all([
    getOverview(),
    prisma.sale.findMany({
      where: { createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { items: true, user: { select: { name: true } } },
    }),
    // Entradas confirmadas, do primeiro ao último horário do período (sem limite).
    prisma.sale.findMany({
      where: { status: "CONFIRMADA", createdAt: { gte: from } },
      orderBy: [{ createdAt: "asc" }, { number: "asc" }],
      select: { id: true, number: true, createdAt: true, total: true, channel: true, customerName: true, customerPhone: true, externalRef: true, items: { select: { description: true, quantity: true } } },
    }),
  ]);

  // Agrupa apenas por dia; cada recebimento permanece na sua posição cronológica.
  const days = new Map<string, typeof inPeriod>();
  for (const sale of inPeriod) {
    const day = dayKey(sale.createdAt);
    const entries = days.get(day) ?? [];
    entries.push(sale);
    days.set(day, entries);
  }
  const hour = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/La_Paz", hour: "2-digit", minute: "2-digit" });
  const dayTitle = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "America/La_Paz", weekday: "long", day: "numeric", month: "long",
  });
  const revenueTotal = inPeriod.reduce((sum, sale) => sum + Number(sale.total), 0);

  const confirmed = sales.filter((s) => s.status === "CONFIRMADA");
  const periodTotal = confirmed.reduce((s, x) => s + Number(x.total), 0);

  return (
    <>
      <PageHeader title="Vendas" subtitle="Tudo o que foi vendido, no balcão e pelo WhatsApp">
        <Link href="/painel/vendas/nova" className="btn-accent">＋ Nova venda</Link>
      </PageHeader>

      {sp.registrada && (
        <p className="mb-4 rounded-lg border border-dourado-500/50 bg-dourado-500/15 px-4 py-3 text-sm font-medium text-dourado-600">
          ✓ Venda #{sp.registrada} registrada e estoque atualizado.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi tone="accent" label="Vendido hoje" value={bs(overview.today.revenue)} hint={`${overview.today.orders} pedido(s)`} href="/painel/vendas?periodo=hoje#por-horario" />
        <Kpi label="Vendido na semana" value={bs(overview.week.revenue)} hint={`${overview.week.orders} pedido(s) · últimos 7 dias`} href="/painel/vendas?periodo=semana#por-horario" />
        <Kpi label="Vendido no mês" value={bs(overview.month.revenue)} hint={`${overview.month.orders} pedido(s)`} href="/painel/vendas?periodo=mes#por-horario" />
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIODS) as Period[]).map((p) => (
            <Link
              key={p}
              href={`/painel/vendas?periodo=${p}`}
              className={`btn py-1.5 ${p === periodo ? "btn-on" : "btn-ghost"}`}
            >
              {PERIODS[p].label}
            </Link>
          ))}
        </div>
        <p className="text-sm text-cacau-500">
          {confirmed.length} venda(s) · <b className="text-cacau-900">{bs(periodTotal)}</b>
        </p>
      </div>

      <section id="por-horario" className="card mb-6 scroll-mt-6">
        <span id="por-cliente" className="scroll-mt-6" aria-hidden="true" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base">O que entrou no faturamento · por horário</h2>
            <p className="mt-1 text-xs text-cacau-500">{PERIODS[periodo].label} · do primeiro ao último recebimento</p>
          </div>
          <p className="text-sm text-cacau-500">
            {inPeriod.length} lançamento(s) · <b className="text-cacau-900">{bs(revenueTotal)}</b>
          </p>
        </div>
        {inPeriod.length === 0 ? (
          <p className="mt-4 text-sm text-cacau-500">Nada entrou no faturamento neste período.</p>
        ) : (
          <div className="mt-5 space-y-5">
            {[...days.entries()].map(([day, entries]) => (
              <div key={day}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-creme-200/60 px-3 py-2">
                  <h3 className="text-xs font-semibold capitalize">{dayTitle(day)}</h3>
                  <span className="text-xs tabular-nums text-cacau-500">{bs(entries.reduce((sum, sale) => sum + Number(sale.total), 0))}</span>
                </div>
                <ol className="divide-y divide-creme-300/70">
                  {entries.map((sale) => (
                    <li key={sale.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4">
                      <time dateTime={sale.createdAt.toISOString()} className="rounded-md bg-creme-200/60 px-1 py-1 text-center text-sm font-semibold tabular-nums">{hour(sale.createdAt)}</time>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{sale.customerName?.trim() || "Sem cliente informado"}</p>
                        <p className="mt-1 whitespace-pre-line break-words text-sm text-cacau-700">
                          {sale.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.description}` : i.description)).join("\n")}
                          {sale.externalRef?.startsWith("encomenda:") && " (restante na entrega)"}
                        </p>
                        <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-cacau-500">
                          <span>#{sale.number}</span>
                          <span>{CHANNEL_LABEL[sale.channel] ?? sale.channel}</span>
                          {sale.customerPhone && <span>{sale.customerPhone}</span>}
                        </p>
                      </div>
                      <span className="whitespace-nowrap pt-1 text-sm font-semibold tabular-nums">{bs(sale.total)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="card overflow-x-auto p-0">
        {sales.length === 0 ? (
          <p className="p-5 text-sm text-cacau-500">Nenhuma venda neste período.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th className="pl-5">#</th>
                <th>Quando</th>
                <th>Itens</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Pagto.</th>
                <th className="text-right">Total</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const cancelled = s.status === "CANCELADA";
                return (
                  <tr key={s.id} className={cancelled ? "text-cacau-400 line-through decoration-cacau-400/60" : ""}>
                    <td className="pl-5 text-cacau-400">{s.number}</td>
                    <td className="whitespace-nowrap">{dateTime(s.createdAt)}</td>
                    <td className="min-w-[16rem]">
                      {s.items.map((i) => (
                        <div key={i.id}>
                          {i.quantity}× {i.description}
                          <span className="text-xs text-cacau-400"> · {bs(i.unitPrice)}</span>
                        </div>
                      ))}
                      {s.notes && <div className="text-xs italic text-cacau-400">{s.notes}</div>}
                    </td>
                    <td className="whitespace-nowrap">
                      {s.customerName ?? "—"}
                      {s.customerPhone && <div className="text-xs text-cacau-400">{s.customerPhone}</div>}
                    </td>
                    <td>{CHANNEL_LABEL[s.channel]}</td>
                    <td>{PAYMENT_LABEL[s.payment]}</td>
                    <td className="whitespace-nowrap text-right font-medium">{bs(s.total)}</td>
                    <td className="whitespace-nowrap pr-5 text-right no-underline">
                      <div className="flex items-center justify-end gap-3">
                        {cancelled ? (
                          <span className="badge bg-creme-200 text-cacau-500 no-underline">Cancelada</span>
                        ) : (
                          <form action={cancelSaleAction}>
                            <input type="hidden" name="saleId" value={s.id} />
                            <ConfirmButton
                              message={`Cancelar a venda #${s.number}? Os itens voltam para o estoque e ela fica na lista como cancelada.`}
                              className="text-xs text-cacau-400 hover:text-coral-600 hover:underline"
                              title="Cancela e devolve os itens ao estoque"
                            >
                              cancelar
                            </ConfirmButton>
                          </form>
                        )}
                        <form action={deleteSaleAction}>
                          <input type="hidden" name="saleId" value={s.id} />
                          <ConfirmButton
                            message={
                              cancelled
                                ? `Excluir a venda #${s.number}? Ela some da lista de vez.`
                                : `Excluir a venda #${s.number}? Os itens voltam para o estoque e ela some da lista de vez.`
                            }
                            className="text-xs text-cacau-400 hover:text-coral-600 hover:underline"
                            title="Apaga a venda de vez"
                          >
                            excluir
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
