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

  const [overview, sales] = await Promise.all([
    getOverview(),
    prisma.sale.findMany({
      where: { createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { items: true, user: { select: { name: true } } },
    }),
  ]);

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
        <Kpi tone="accent" label="Vendido hoje" value={bs(overview.today.revenue)} hint={`${overview.today.orders} venda(s)`} />
        <Kpi label="Vendido na semana" value={bs(overview.week.revenue)} hint={`${overview.week.orders} venda(s) · últimos 7 dias`} />
        <Kpi label="Vendido no mês" value={bs(overview.month.revenue)} hint={`${overview.month.orders} venda(s)`} />
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
