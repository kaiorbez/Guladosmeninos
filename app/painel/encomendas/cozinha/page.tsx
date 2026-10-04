import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/time";
import { decorationPhotoUrl } from "@/lib/orders";

const DAY_MS = 24 * 60 * 60 * 1000;
const shift = (k: string, days: number) => new Date(new Date(`${k}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** Folha da cozinha: encomendas do dia para produzir, sem valores. Feita para imprimir. */
export default async function FolhaCozinha({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const sp = await searchParams;
  const today = dayKey(new Date());
  const day = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : today;

  const orders = await prisma.order.findMany({
    where: { status: "PENDENTE", deliveryDate: new Date(`${day}T00:00:00Z`) },
    orderBy: [{ deliveryTime: "asc" }, { number: "asc" }],
  });

  const title = new Date(`${day}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Link href={`/painel/encomendas/cozinha?dia=${shift(day, -1)}`} className="btn-icon border border-creme-300" aria-label="Dia anterior">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <Link href={`/painel/encomendas/cozinha?dia=${today}`} className={`btn py-1.5 ${day === today ? "btn-on" : "btn-ghost"}`}>Hoje</Link>
          <Link href={`/painel/encomendas/cozinha?dia=${shift(today, 1)}`} className={`btn py-1.5 ${day === shift(today, 1) ? "btn-on" : "btn-ghost"}`}>Amanhã</Link>
          <Link href={`/painel/encomendas/cozinha?dia=${shift(day, 1)}`} className="btn-icon border border-creme-300" aria-label="Próximo dia">
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
        <PrintButton />
      </div>

      <header className="mb-4 border-b-2 border-cacau-900 pb-3">
        <p className="text-xs uppercase tracking-wider text-cacau-500">Gula dos Meninos · Folha da cozinha</p>
        <h1 className="text-2xl capitalize">{title}</h1>
        <p className="text-sm text-cacau-500">{orders.length} encomenda(s) para produzir</p>
      </header>

      {orders.length === 0 ? (
        <p className="py-10 text-center text-cacau-500">Nenhuma encomenda pendente para este dia.</p>
      ) : (
        <ol className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="break-inside-avoid rounded-lg border border-creme-300 bg-creme-50 p-4 print:rounded-none print:border-x-0 print:border-t-0 print:bg-transparent">
              <div className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 text-xl font-semibold tabular-nums">{o.deliveryTime === "AGORA" ? "Agora" : o.deliveryTime ?? "—"}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-lg font-semibold">{o.product}</p>
                  <p className="text-sm text-cacau-500">#{o.number} · {o.customerName}</p>
                </div>
                <span className="size-5 shrink-0 rounded border-2 border-cacau-400" aria-hidden title="Feito" />
              </div>
              <dl className="ml-[4.25rem] mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[15px] sm:grid-cols-4">
                {[
                  ["Massa", o.dough],
                  ["Recheio", o.filling],
                  ["Cobertura", o.topping],
                  ["Decoração", o.decoration],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] uppercase tracking-wide text-cacau-400">{label}</dt>
                    <dd className="font-medium">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              {o.notes && <p className="ml-[4.25rem] mt-2 text-sm">Obs.: {o.notes}</p>}
              {decorationPhotoUrl(o) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={decorationPhotoUrl(o)!} alt="Foto da decoração" className="ml-[4.25rem] mt-2 h-40 w-40 rounded-md border border-creme-300 object-cover" />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

