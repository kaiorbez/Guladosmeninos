import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { PAYMENT_LABEL, bs } from "@/lib/format";
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
    prisma.sale.aggregate({
      where: { status: "CONFIRMADA", createdAt: { gte: monthStart(ym), lt: monthStart(next) } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.expense.findMany({
      where: { date: { gte: new Date(`${ym}-01T00:00:00Z`), lt: new Date(`${next}-01T00:00:00Z`) } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const income = Number(revenue._sum.total ?? 0);
  const byCategory = Object.keys(EXPENSE_LABEL).map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
  }));
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
        <Kpi label="Faturamento" value={bs(income)} hint={`${revenue._count} venda(s) no mês`} />
        <Kpi label="Despesas" value={bs(totalExpenses)} hint={`${expenses.length} lançamento(s)`} />
        <Kpi tone="accent" label="Resultado" value={bs(result)} hint={margin === null ? "sem faturamento no mês" : `margem de ${margin}%`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <h2 className="text-base">DRE · {monthTitle}</h2>
          <table className="table-base mt-3">
            <tbody>
              <tr>
                <td className="font-semibold">(+) Faturamento (vendas)</td>
                <td className="text-right font-semibold tabular-nums">{bs(income)}</td>
              </tr>
              {byCategory.map((c) => (
                <tr key={c.cat}>
                  <td className="pl-6 text-cacau-700">(−) {EXPENSE_LABEL[c.cat]}</td>
                  <td className="text-right tabular-nums text-cacau-700">{c.total ? bs(c.total) : "—"}</td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold">(−) Total de despesas</td>
                <td className="text-right font-semibold tabular-nums">{bs(totalExpenses)}</td>
              </tr>
              <tr className="bg-creme-200/60">
                <td className="text-base font-bold">(=) Resultado do mês</td>
                <td className={`text-right text-base font-bold tabular-nums ${result < 0 ? "text-coral-600" : ""}`}>{bs(result)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-cacau-500">
            Faturamento = vendas confirmadas do mês (balcão, WhatsApp, PedidosYa, encomendas e pagamentos de encomendas).
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
                <th>Descrição</th>
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
