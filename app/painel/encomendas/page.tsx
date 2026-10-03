import Link from "next/link";
import { ClockIcon, MessageCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { bs } from "@/lib/format";
import { dayKey } from "@/lib/time";
import { decorationPhotoUrl, lateLabel, minutesLate } from "@/lib/orders";
import { ORDER_CHANNELS, PAYMENT_METHODS as METHODS } from "@/lib/format";
import type { SaleChannel } from "@prisma/client";
import { OrderFilters } from "./OrderFilters";
import { deleteOrderAction, payRestAction, setOrderStatusAction } from "./actions";

const TABS = {
  proximas: { label: "Próximas", status: "PENDENTE" },
  entregues: { label: "Entregues", status: "ENTREGUE" },
  canceladas: { label: "Canceladas", status: "CANCELADA" },
} as const;
type Tab = keyof typeof TABS;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Link do WhatsApp: número boliviano de 8 dígitos ganha o código 591. */
function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits.length === 8 ? `591${digits}` : digits}`;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-cacau-400">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

export default async function EncomendasPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; hora?: string; dia?: string; pgto?: string; canal?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = sp.aba && sp.aba in TABS ? (sp.aba as Tab) : "proximas";
  const pendingTab = tab === "proximas";
  const q = sp.q?.trim();
  // Filtros: hora "12" = 12:00 a 12:59; "sem" = sem horário. dia = YYYY-MM-DD.
  const hora = sp.hora === "sem" || /^\d{2}$/.test(sp.hora ?? "") ? sp.hora! : "";
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") ? sp.dia! : "";
  const pgto = sp.pgto === "falta" || sp.pgto === "pago" ? sp.pgto : "";
  const canal = ORDER_CHANNELS.some(([v]) => v === sp.canal) ? (sp.canal as SaleChannel) : "";

  const [found, pending, timeRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: TABS[tab].status,
        ...(hora === "sem" ? { deliveryTime: null } : hora ? { deliveryTime: { startsWith: `${hora}:` } } : {}),
        ...(dia ? { deliveryDate: new Date(`${dia}T00:00:00Z`) } : {}),
        ...(canal ? { channel: canal } : {}),
        ...(q
          ? {
              OR: [
                { customerName: { contains: q, mode: "insensitive" as const } },
                { product: { contains: q, mode: "insensitive" as const } },
                { customerPhone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ deliveryDate: pendingTab ? "asc" : "desc" }, { deliveryTime: "asc" }],
      take: 200,
    }),
    prisma.order.findMany({ where: { status: "PENDENTE" }, select: { deliveryDate: true, total: true, paid: true } }),
    // Horários que existem nesta aba, para as opções do filtro.
    prisma.order.findMany({ where: { status: TABS[tab].status, deliveryTime: { not: null } }, select: { deliveryTime: true }, distinct: ["deliveryTime"] }),
  ]);
  const orders = pgto ? found.filter((o) => (Number(o.total) - Number(o.paid) > 0) === (pgto === "falta")) : found;
  const hours = [...new Set(timeRows.map((r) => r.deliveryTime!.slice(0, 2)).filter((h) => /^\d{2}$/.test(h)))].sort();
  const filtering = Boolean(q || hora || dia || pgto || canal);

  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + DAY_MS));
  const weekEnd = dayKey(new Date(Date.now() + 6 * DAY_MS));
  const key = (d: Date) => d.toISOString().slice(0, 10);

  const forToday = pending.filter((o) => key(o.deliveryDate) === today).length;
  const forWeek = pending.filter((o) => key(o.deliveryDate) >= today && key(o.deliveryDate) <= weekEnd).length;
  const toReceive = pending.reduce((s, o) => s + Number(o.total) - Number(o.paid), 0);

  // Agrupa por dia de entrega, como uma folha do bloco por dia.
  const days = new Map<string, typeof orders>();
  for (const o of orders) {
    const k = key(o.deliveryDate);
    days.set(k, [...(days.get(k) ?? []), o]);
  }
  const dayTitle = (k: string) => {
    const text = new Date(`${k}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <>
      <PageHeader title="Encomendas" subtitle="O que produzir, para quando e quanto falta receber">
        <Link href="/painel/encomendas/cozinha" className="btn-ghost">Folha da cozinha</Link>
        <Link href="/painel/encomendas/nova" className="btn-accent">＋ Nova encomenda</Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi tone="accent" label="Para hoje" value={String(forToday)} hint="encomenda(s) pendente(s)" />
        <Kpi label="Próximos 7 dias" value={String(forWeek)} hint="contando hoje" />
        <Kpi label="Falta receber" value={bs(toReceive)} hint={`${pending.length} encomenda(s) pendente(s)`} />
      </div>

      <div className="mb-5 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <Link key={t} href={`/painel/encomendas?aba=${t}`} className={`btn py-1.5 ${t === tab ? "btn-on" : "btn-ghost"}`}>
              {TABS[t].label}
            </Link>
          ))}
        </div>
      </div>

      <OrderFilters
        values={{ aba: tab, q: q ?? "", hora, dia, pgto, canal }}
        hours={hours}
        channels={ORDER_CHANNELS}
        today={today}
        tomorrow={tomorrow}
      />
      {filtering && orders.length > 0 && (
        <p className="-mt-2 mb-4 text-sm text-cacau-500">{orders.length} encomenda(s) encontrada(s) com esses filtros.</p>
      )}

      {orders.length === 0 && (
        <div className="card flex flex-col items-center py-10 text-center">
          <p className="font-medium">{filtering ? "Nenhuma encomenda com esses filtros." : pendingTab ? "Nenhuma encomenda pendente." : "Nenhuma encomenda aqui."}</p>
          {pendingTab && !filtering && (
            <>
              <p className="mt-1 text-sm text-cacau-500">Registre a próxima para ela aparecer na agenda da cozinha.</p>
              <Link href="/painel/encomendas/nova" className="btn-accent mt-4">＋ Nova encomenda</Link>
            </>
          )}
        </div>
      )}

      <div className="space-y-8">
        {[...days.entries()].map(([k, list]) => {
          const late = pendingTab && k < today;
          const dayMissing = list.reduce((s, o) => s + Number(o.total) - Number(o.paid), 0);
          return (
            <section key={k}>
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-creme-300 pb-2">
                <h2 className="text-base">{dayTitle(k)}</h2>
                {pendingTab && k === today && <span className="badge bg-dourado-400/25 text-dourado-600">Hoje</span>}
                {pendingTab && k === tomorrow && <span className="badge bg-creme-200 text-cacau-700">Amanhã</span>}
                {late && <span className="badge bg-coral-500 text-white">Atrasada</span>}
                <span className="ml-auto text-sm text-cacau-500">
                  {list.length} encomenda(s)
                  {dayMissing > 0 && <> · falta <b className="text-coral-600">{bs(dayMissing)}</b></>}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {list.map((o) => {
                  const missing = Number(o.total) - Number(o.paid);
                  const lateMin = minutesLate(o);
                  const wa = o.customerPhone ? whatsappUrl(o.customerPhone) : null;
                  return (
                    <article key={o.id} className={`card flex flex-col p-0 ${late || lateMin !== null ? "border-coral-500/60" : ""}`}>
                      <header className="flex items-start gap-3 px-5 pt-4">
                        <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-creme-200 py-2">
                          <ClockIcon className="size-3.5 text-cacau-500" />
                          <span className="mt-0.5 text-sm font-semibold tabular-nums">{o.deliveryTime ?? "—"}</span>
                          {lateMin !== null && (
                            <span className="mt-1 rounded bg-coral-500 px-1 text-center text-[10px] font-semibold leading-tight text-white">
                              Atrasada {lateLabel(lateMin)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">{o.customerName}</p>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-cacau-500">
                            <span className="tabular-nums">#{o.number}</span>
                            {o.customerPhone &&
                              (wa ? (
                                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 tabular-nums hover:text-cacau-900 hover:underline">
                                  <MessageCircleIcon className="size-3" />
                                  {o.customerPhone}
                                </a>
                              ) : (
                                <span className="tabular-nums">{o.customerPhone}</span>
                              ))}
                          </p>
                        </div>
                        {missing > 0 ? (
                          <span className="badge shrink-0 bg-coral-500/15 text-coral-600">Falta {bs(missing)}</span>
                        ) : (
                          <span className="badge shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Pago</span>
                        )}
                      </header>

                      <div className="px-5 py-4">
                        <p className="whitespace-pre-line text-[15px] font-medium">{o.product}</p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <Detail label="Massa" value={o.dough} />
                          <Detail label="Recheio" value={o.filling} />
                          <Detail label="Cobertura" value={o.topping} />
                          <Detail label="Decoração" value={o.decoration} />
                        </dl>
                        {decorationPhotoUrl(o) && (
                          <a href={decorationPhotoUrl(o)!} target="_blank" rel="noreferrer" className="mt-3 block w-fit" title="Abrir foto da decoração">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={decorationPhotoUrl(o)!} alt="Foto da decoração" loading="lazy" className="h-28 w-28 rounded-lg border border-creme-300 object-cover" />
                          </a>
                        )}
                        {o.notes && <p className="mt-3 rounded-md bg-creme-200/70 px-3 py-2 text-sm text-cacau-700">{o.notes}</p>}
                      </div>

                      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-creme-300 px-5 py-3">
                        <p className="mr-auto text-sm tabular-nums text-cacau-500">
                          Total <b className="text-cacau-900">{bs(o.total)}</b> · pago {bs(o.paid)}
                        </p>
                        {o.status !== "CANCELADA" && missing > 0 && (
                          <form action={payRestAction} className="flex items-center">
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="amount" value={missing} />
                            <select name="method" aria-label="Forma de pagamento" className="input h-[34px] w-auto rounded-r-none border-r-0 px-2 py-1 text-xs">
                              {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <ConfirmButton message={`Marcar ${bs(missing)} como recebido?`} className="btn-ghost rounded-l-none py-1.5">
                              Receber {bs(missing)}
                            </ConfirmButton>
                          </form>
                        )}
                        {o.status === "ENTREGUE" && (o.saleId || Number(o.paid) > 0) && (
                          <span className="badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">No faturamento</span>
                        )}
                        {pendingTab && (
                          <form action={setOrderStatusAction}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="status" value="ENTREGUE" />
                            <ConfirmButton
                              message={
                                missing > 0
                                  ? `Ainda falta receber ${bs(missing)}. Marcar como entregue mesmo assim? A venda de ${bs(o.total)} entra no faturamento.`
                                  : `Marcar como entregue? A venda de ${bs(o.total)} entra no faturamento.`
                              }
                              className="btn-primary py-1.5"
                            >
                              Entregue
                            </ConfirmButton>
                          </form>
                        )}
                        <Link
                          href={`/painel/encomendas/nova?cliente=${o.id}`}
                          className="btn-ghost px-2.5 py-1.5 text-xs"
                          title={`Mais um pedido para ${o.customerName}`}
                        >
                          <PlusIcon className="size-3.5" /> Pedido p/ este cliente
                        </Link>
                        <Link href={`/painel/encomendas/${o.id}`} className="btn-icon border border-creme-300" aria-label="Editar encomenda" title="Editar">
                          <PencilIcon className="size-3.5" />
                        </Link>
                        <div className="flex basis-full justify-end gap-4">
                          <form action={setOrderStatusAction}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="status" value={pendingTab ? "CANCELADA" : "PENDENTE"} />
                            {pendingTab ? (
                              <ConfirmButton message={`Cancelar a encomenda #${o.number}?`} className="text-xs text-cacau-400 hover:text-coral-600 hover:underline">
                                cancelar encomenda
                              </ConfirmButton>
                            ) : (
                              <button className="text-xs text-cacau-400 hover:text-cacau-900 hover:underline">voltar para pendente</button>
                            )}
                          </form>
                          <form action={deleteOrderAction}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <ConfirmButton
                              message={`Excluir a encomenda #${o.number} de ${o.customerName}? Ela some de vez e não dá para desfazer.`}
                              className="text-xs text-cacau-400 hover:text-coral-600 hover:underline"
                            >
                              excluir
                            </ConfirmButton>
                          </form>
                        </div>
                      </footer>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
