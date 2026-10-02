"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveOrderAction } from "@/app/painel/encomendas/actions";

export type OrderValues = {
  id?: string;
  deliveryDate: string;
  deliveryTime: string;
  customerName: string;
  customerPhone: string;
  product: string;
  dough: string;
  filling: string;
  topping: string;
  decoration: string;
  total: string;
  paid: string;
  notes: string;
};

type Suggestions = { product: string[]; dough: string[]; filling: string[]; topping: string[] };

const fmt = (n: number) => `Bs ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
const parse = (s: string) => Number(s.replace(",", ".")) || 0;

/** Mesma ficha do bloco de papel da cozinha. */
export function OrderForm({
  values,
  today,
  tomorrow,
  suggestions,
}: {
  values: OrderValues;
  today: string;
  tomorrow: string;
  suggestions: Suggestions;
}) {
  const [error, action, pending] = useActionState(saveOrderAction, null);
  const [date, setDate] = useState(values.deliveryDate);
  const [total, setTotal] = useState(values.total);
  const [paid, setPaid] = useState(values.paid);
  const missing = Math.max(parse(total) - parse(paid), 0);

  const field = (
    name: keyof OrderValues,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    options?: string[],
  ) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={values[name]} className="input" list={options ? `sugestoes-${name}` : undefined} {...props} />
      {options && (
        <datalist id={`sugestoes-${name}`}>
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
    </div>
  );

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <section className="card space-y-4">
        <h2 className="text-base">Entrega</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="deliveryDate">Dia da entrega</label>
            <input id="deliveryDate" name="deliveryDate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setDate(today)} className={`btn px-2.5 py-1 text-xs ${date === today ? "btn-on" : "btn-ghost"}`}>Hoje</button>
              <button type="button" onClick={() => setDate(tomorrow)} className={`btn px-2.5 py-1 text-xs ${date === tomorrow ? "btn-on" : "btn-ghost"}`}>Amanhã</button>
            </div>
          </div>
          {field("deliveryTime", "Horário de entrega", { type: "time" })}
          {field("customerName", "Cliente", { required: true })}
          {field("customerPhone", "Celular", { inputMode: "tel" })}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-base">Pedido</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("product", "Produto", { required: true, placeholder: "Ex.: Bolo P" }, suggestions.product)}</div>
          {field("dough", "Massa", { placeholder: "Ex.: chocolate" }, suggestions.dough)}
          {field("filling", "Recheio", { placeholder: "Ex.: maracujá" }, suggestions.filling)}
          {field("topping", "Cobertura", {}, suggestions.topping)}
          {field("decoration", "Decoração", { placeholder: "Ex.: modelo 10" })}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Observação</label>
            <textarea id="notes" name="notes" defaultValue={values.notes} rows={2} className="input" placeholder="Entrega, retirada, nome na torta..." />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-base">Pagamento</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="total">Valor total (Bs)</label>
            <input id="total" name="total" value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="paid">Valor pago (Bs)</label>
            <input id="paid" name="paid" value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className="input" />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setPaid(String(parse(total) / 2))} className="btn-ghost px-2.5 py-1 text-xs">Metade</button>
              <button type="button" onClick={() => setPaid(total)} className="btn-ghost px-2.5 py-1 text-xs">Tudo</button>
            </div>
          </div>
          <div>
            <span className="label">Falta</span>
            <p className={`py-1.5 text-xl font-semibold tabular-nums ${missing > 0 ? "text-coral-600" : ""}`}>{fmt(missing)}</p>
          </div>
        </div>
      </section>

      {error && <p className="text-sm font-medium text-coral-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-accent">
          {pending ? "Salvando..." : values.id ? "Salvar alterações" : "Registrar encomenda"}
        </button>
        <Link href="/painel/encomendas" className="btn-ghost">Voltar</Link>
      </div>
    </form>
  );
}
