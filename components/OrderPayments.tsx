"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";
import { addPaymentAction, deletePaymentAction } from "@/app/painel/encomendas/actions";
import { PAYMENT_METHODS as METHODS } from "@/lib/format";
import { ConfirmButton } from "./ConfirmButton";

type Payment = { id: string; amount: number; method: string; paidAt: string };

const fmt = (n: number) => `Bs ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHODS);

/** Histórico de pagamentos da encomenda (sinal, restante...) e registro de um novo. */
export function OrderPayments({ orderId, payments, missing }: { orderId: string; payments: Payment[]; missing: number }) {
  const [error, action, pending] = useActionState(addPaymentAction, null);

  return (
    <section className="card max-w-2xl">
      <h2 className="text-base">Pagamentos</h2>
      {payments.length === 0 ? (
        <p className="mt-2 text-sm text-cacau-500">Nenhum pagamento registrado.</p>
      ) : (
        <ul className="mt-2 divide-y divide-creme-300/60 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-28 tabular-nums text-cacau-500">
                {new Date(p.paidAt).toLocaleString("pt-BR", { timeZone: "America/La_Paz", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex-1">{METHOD_LABEL[p.method] ?? p.method}</span>
              <span className="font-medium tabular-nums">{fmt(p.amount)}</span>
              <form action={deletePaymentAction}>
                <input type="hidden" name="paymentId" value={p.id} />
                <ConfirmButton message={`Apagar o pagamento de ${fmt(p.amount)}?`} className="btn-icon" title="Apagar pagamento">
                  <Trash2Icon className="size-3.5" />
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {missing > 0 ? (
        <form action={action} className="mt-4 flex flex-wrap items-end gap-2 border-t border-creme-300 pt-4">
          <input type="hidden" name="orderId" value={orderId} />
          <div>
            <label className="label" htmlFor="amount">Novo pagamento (Bs)</label>
            <input id="amount" name="amount" defaultValue={String(missing)} inputMode="decimal" className="input w-32" />
          </div>
          <select name="method" aria-label="Forma de pagamento" className="input w-auto">
            {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button disabled={pending} className="btn-primary">{pending ? "Registrando..." : "Registrar pagamento"}</button>
          {error && <p className="basis-full text-sm font-medium text-coral-600">{error}</p>}
        </form>
      ) : (
        <p className="mt-4 border-t border-creme-300 pt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">Encomenda paga.</p>
      )}
    </section>
  );
}
