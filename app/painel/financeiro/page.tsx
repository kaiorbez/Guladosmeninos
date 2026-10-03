import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { CHANNEL_LABEL, PAYMENT_LABEL, bs } from "@/lib/format";
import { dayKey } from "@/lib/time";
import { deleteExpenseAction } from "./actions";
import { ExpenseForm } from "./ExpenseForm";
import { EXPENSE_LABEL } from "./labels";

// Bolívia é UTC-4: o mês de La Paz começa às 04:00 UTC do dia 1.
const monthStart = (ym: string) => new Date(`${ym}-01T04:00:00Z`);
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const current = dayKey(new Date()).slice(0, 7);
  const ym = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : current;
  const next = shiftMonth(ym, 1);

  const [revenue, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { status: "CONFIRMADA", createdAt: { gte: monthStart(ym), lt: monthStart(next) } },
      select: { total: true, channel: true, externalRef: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: new Date(`${ym}-01T00:00:00Z`), lt: new Date(`${next}-01T00:00:00Z`) } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const income = revenue.reduce((t, x) => t + Number(x.total), 0);
  // Faturamento por origem: encomendas (sinal, pagamentos, entrega) separadas dos canais de venda.
  const incomeBySource = new Map<string, number>();
  for (const x of revenue) {
    const source = x.externalRef?.startsWith("encomenda") ? "Encomendas" : (CHANNEL_LABEL[x.channel] ?? x.channel);
    incomeBySource.set(source, (incomeBySource.get(source) ?? 0) + Number(x.total));
  }
  const sources = [...incomeBySource.entries()].sort((a, b) => b[1] - a[1]);

  const byCategory = Object.keys(EXPENSE_LABEL).map((cat) => {
    const items = expenses.filter((e) => e.category === cat);
    // Agrupa pelo título (em "Outros" é o que diz do que é cada gasto).
    const titles = new Map<string, { total: number; count: number }>();
    for (const e of items) {
      const t = e.description?.trim() || "Sem título";
      const row = titles.get(t) ?? { total: 0, count: 0 };
      row.total += Number(e.amount);
      row.count += 1;
      titles.set(t, row);
    }
    return {
      cat,
      items,
      titles: [...titles.entries()].sort((a, b) => b[1].total - a[1].total),
      total: items.reduce((t, e) => t + Number(e.amount), 0),
    };
  });
  const pct = (v: number) => (income > 0 ? `${Math.round((v / income) * 100)}%` : "—");
  const totalExpenses = byCategory.reduce((s, c) => s + c.total, 0);
  const result = income - totalExpenses;
  const margin = income > 0 ? Math.round((result / income) * 100) : null;

  const monthTitle = (() => {
    const t = new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();
  const defaultDate = ym === current ? dayKey(new Date()) : `${ym}-01`;

  return (
    <>
      <PageHeader title="Financeiro (DRE)" subtitle="Faturamento do mês menos as despesas">
        <div className="flex items-center gap-2">
          <Link href={`/painel/financeiro?mes=${shiftMonth(ym, -1)}`} className="btn-icon border border-creme-300" aria-label="Mês anterior">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-semibold">{monthTitle}</span>
          <Link href={`/painel/financeiro?mes=${next}`} className="btn-icon border border-creme-300" aria-label="Próximo mês">
            <ChevronRightIcon className="size-4" />
          </Link>
          {ym !== current && <Link href="/painel/financeiro" className="btn-ghost py-1.5">Mês atual</Link>}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Faturamento" value={bs(income)} hint={`${revenue.length} lançamento(s) de venda no mês`} />
        <Kpi label="Despesas" value={bs(totalExpenses)} hint={`${expenses.length} lançamento(s)`} />
        <Kpi tone="accent" label="Resultado" value={bs(result)} hint={margin === null ? "sem faturamento no mês" : `margem de ${margin}%`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base">DRE · {monthTitle}</h2>
            <span className="text-xs text-cacau-500">clique numa linha para ver os lançamentos</span>
          </div>

          <div className="mt-3 text-sm">
            <div className="grid grid-cols-[1fr_7rem_4rem] gap-3 border-b border-creme-300 px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-cacau-500">
              <span>Conta</span>
              <span className="text-right">Valor</span>
              <span className="text-right">% fat.</span>
            </div>

            {/* Faturamento, aberto por origem */}
            <details className="group border-b border-creme-300/70">
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_7rem_4rem] gap-3 px-3 py-2.5 hover:bg-creme-200/50 [&::-webkit-details-marker]:hidden">
                <span className="font-semibold">
                  <span className="mr-1 inline-block text-[10px] text-cacau-400 transition-transform group-open:rotate-90">▶</span>
                  (+) Faturamento
                </span>
                <span className="text-right font-semibold tabular-nums">{bs(income)}</span>
                <span className="text-right tabular-nums text-cacau-500">{income > 0 ? "100%" : "—"}</span>
              </summary>
              <div className="pb-2">
                {sources.length === 0 ? (
                  <p className="px-3 py-1 pl-8 text-cacau-500">Nenhuma venda neste mês.</p>
                ) : (
                  sources.map(([name, value]) => (
                    <div key={name} className="grid grid-cols-[1fr_7rem_4rem] gap-3 px-3 py-1 text-cacau-700">
                      <span className="pl-5">{name}</span>
                      <span className="text-right tabular-nums">{bs(value)}</span>
                      <span className="text-right tabular-nums text-cacau-500">{pct(value)}</span>
                    </div>
                  ))
                )}
              </div>
            </details>

            {/* Despesas por categoria, cada uma abre os lançamentos */}
            {byCategory.map((c) => (
              <details key={c.cat} className="group border-b border-creme-300/70">
                <summary className="grid cursor-pointer list-none grid-cols-[1fr_7rem_4rem] gap-3 px-3 py-2.5 hover:bg-creme-200/50 [&::-webkit-details-marker]:hidden">
                  <span className="pl-3 text-cacau-700">
                    <span className="mr-1 inline-block text-[10px] text-cacau-400 transition-transform group-open:rotate-90">▶</span>
                    (−) {EXPENSE_LABEL[c.cat]}
                    {c.items.length > 0 && <span className="ml-1.5 text-xs text-cacau-400">({c.items.length})</span>}
                  </span>
                  <span className="text-right tabular-nums text-cacau-700">{c.total ? bs(c.total) : "—"}</span>
                  <span className="text-right tabular-nums text-cacau-500">{c.total ? pct(c.total) : ""}</span>
                </summary>
                <div className="pb-2">
                  {c.items.length === 0 ? (
                    <p className="px-3 py-1 pl-11 text-cacau-500">Nenhum lançamento em {EXPENSE_LABEL[c.cat].toLowerCase()} neste mês.</p>
                  ) : (
                    c.titles.map(([title, t]) => (
                      <div key={title}>
                        <div className="grid grid-cols-[1fr_7rem_4rem] gap-3 px-3 py-1">
                          <span className="pl-8 font-medium">
                            {title}
                            {t.count > 1 && <span className="ml-1.5 text-xs font-normal text-cacau-400">{t.count} lançamentos</span>}
                          </span>
                          <span className="text-right tabular-nums">{bs(t.total)}</span>
                          <span className="text-right tabular-nums text-cacau-500">{pct(t.total)}</span>
                        </div>
                        {t.count > 1 &&
                          c.items
                            .filter((e) => (e.description?.trim() || "Sem título") === title)
                            .map((e) => (
                              <div key={e.id} className="grid grid-cols-[1fr_7rem_4rem] gap-3 px-3 text-xs text-cacau-500">
                                <span className="pl-12">{e.date.toISOString().slice(8, 10)}/{e.date.toISOString().slice(5, 7)}</span>
                                <span className="text-right tabular-nums">{bs(e.amount)}</span>
                                <span />
                              </div>
                            ))}
                      </div>
                    ))
                  )}
                </div>
              </details>
            ))}

            <div className="grid grid-cols-[1fr_7rem_4rem] gap-3 border-b border-creme-300 px-3 py-2.5">
              <span className="font-semibold">(−) Total de despesas</span>
              <span className="text-right font-semibold tabular-nums">{bs(totalExpenses)}</span>
              <span className="text-right tabular-nums text-cacau-500">{totalExpenses ? pct(totalExpenses) : ""}</span>
            </div>
            <div className="grid grid-cols-[1fr_7rem_4rem] gap-3 rounded-b-lg bg-creme-200/60 px-3 py-3">
              <span className="text-base font-bold">(=) Resultado do mês</span>
              <span className={`text-right text-base font-bold tabular-nums ${result < 0 ? "text-coral-600" : ""}`}>{bs(result)}</span>
              <span className="text-right tabular-nums text-cacau-500">{margin === null ? "" : `${margin}%`}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-cacau-500">
            Faturamento = vendas confirmadas do mês. “Encomendas” soma sinais, pagamentos e restantes recebidos no mês.
          </p>
        </section>

        <div className="xl:col-span-2">
          <ExpenseForm defaultDate={defaultDate} />
        </div>
      </div>

      <section className="card mt-6 overflow-x-auto p-0">
        <h2 className="px-5 pt-4 text-base">Despesas de {monthTitle.toLowerCase()}</h2>
        {expenses.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-cacau-500">Nenhuma despesa lançada neste mês.</p>
        ) : (
          <table className="table-base mt-2">
            <thead>
              <tr>
                <th className="pl-5">Data</th>
                <th>Categoria</th>
                <th>Título</th>
                <th>Pago com</th>
                <th className="text-right">Valor</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap pl-5 tabular-nums">{e.date.toISOString().slice(8, 10)}/{e.date.toISOString().slice(5, 7)}</td>
                  <td>{EXPENSE_LABEL[e.category]}</td>
                  <td className="text-cacau-700">{e.description ?? "—"}</td>
                  <td className="text-cacau-500">{e.method ? PAYMENT_LABEL[e.method] : "—"}</td>
                  <td className="whitespace-nowrap text-right font-medium tabular-nums">{bs(e.amount)}</td>
                  <td className="pr-5 text-right">
                    <form action={deleteExpenseAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmButton message={`Apagar a despesa de ${bs(e.amount)}?`} className="btn-icon" title="Apagar despesa">
                        <Trash2Icon className="size-3.5" />
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
