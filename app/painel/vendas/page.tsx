import Link from "next/link";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { CHANNEL_LABEL, PAYMENT_LABEL, bs, dateTime } from "@/lib/format";
import { getOverview } from "@/lib/metrics";
import { startOfDay, startOfMonth } from "@/lib/time";
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
    // Tudo o que entrou no faturamento do período (sem limite), para o resumo por cliente.
    prisma.sale.findMany({
      where: { status: "CONFIRMADA", createdAt: { gte: from } },
      orderBy: { createdAt: "asc" },
      select: { id: true, number: true, createdAt: true, total: true, channel: true, customerName: true, customerPhone: true, externalRef: true, items: { select: { description: true, quantity: true } } },
    }),
  ]);

  // Resumo por cliente: junta pelo celular (com ou sem 591); sem celular, pelo nome.
  type ClientRow = { key: string; name: string; phone: string | null; total: number; sales: typeof inPeriod };
  const byClient = new Map<string, ClientRow>();
  for (const sale of inPeriod) {
    const digits = (sale.customerPhone ?? "").replace(/\D/g, "");
    const phone = digits.length === 11 && digits.startsWith("591") ? digits.slice(3) : digits;
    const name = sale.customerName?.trim() || "";
    const key = phone.length >= 7 ? `tel:${phone}` : name ? `nome:${name.toLowerCase()}` : "sem-cliente";
    const row = byClient.get(key) ?? { key, name: name || (phone ? phone : "Sem cliente informado"), phone: phone.length >= 7 ? phone : null, total: 0, sales: [] };
    if (name) row.name = name;
    row.total += Number(sale.total);
    row.sales.push(sale);
    byClient.set(key, row);
  }
  const clientRows = [...byClient.values()].sort((a, b) => b.total - a.total);
  const hour = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/La_Paz", ...(periodo === "hoje" ? {} : { day: "2-digit", month: "2-digit" }), hour: "2-digit", minute: "2-digit" });

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
        <Kpi tone="accent" label="Vendido hoje" value={bs(overview.today.revenue)} hint={`${overview.today.orders} pedido(s)`} href="/painel/vendas?periodo=hoje#por-cliente" />
        <Kpi label="Vendido na semana" value={bs(overview.week.revenue)} hint={`${overview.week.orders} pedido(s) · últimos 7 dias`} href="/painel/vendas?periodo=semana#por-cliente" />
        <Kpi label="Vendido no mês" value={bs(overview.month.revenue)} hint={`${overview.month.orders} pedido(s)`} href="/painel/vendas?periodo=mes#por-cliente" />
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

      <section id="por-cliente" className="card mb-6 scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base">O que entrou no faturamento · {PERIODS[periodo].label.toLowerCase()}, por cliente</h2>
          <p className="text-sm text-cacau-500">
            {clientRows.length} cliente(s) · <b className="text-cacau-900">{bs(clientRows.reduce((t, c) => t + c.total, 0))}</b>
          </p>
        </div>
        {clientRows.length === 0 ? (
          <p className="mt-3 text-sm text-cacau-500">Nada entrou no faturamento neste período.</p>
        ) : (
          <ul className="mt-3 divide-y divide-creme-300/70">
            {clientRows.map((c) => (
              <li key={c.key} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">
                    {c.name}
                    {c.phone && <span className="ml-2 text-xs font-normal text-cacau-500">{c.phone}</span>}
                  </p>
                  <p className="whitespace-nowrap font-semibold tabular-nums">{bs(c.total)}</p>
                </div>
                <ul className="mt-1 space-y-0.5 text-sm text-cacau-700">
                  {c.sales.map((sale) => (
                    <li key={sale.id} className="flex items-baseline gap-3">
                      <span className="w-24 shrink-0 tabular-nums text-cacau-500">{hour(sale.createdAt)}</span>
                      <span className="min-w-0 flex-1">
                        {sale.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.description}` : i.description)).join(", ")}
                        {sale.externalRef?.startsWith("encomenda:") && " (restante na entrega)"}
                        <span className="ml-2 text-xs text-cacau-400">{CHANNEL_LABEL[sale.channel] ?? sale.channel}</span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums">{bs(sale.total)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
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
