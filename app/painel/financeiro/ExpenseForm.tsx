"use client";

import { useActionState, useEffect, useRef } from "react";
import { PAYMENT_METHODS } from "@/lib/format";
import { addExpenseAction } from "./actions";
import { EXPENSE_LABEL } from "./labels";

/** Lançar uma despesa (aluguel, fornecedor, funcionário, energia, outros). */
export function ExpenseForm({ defaultDate }: { defaultDate: string }) {
  const [error, action, pending] = useActionState(addExpenseAction, null);
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && !error) {
      form.current?.querySelector<HTMLInputElement>("input[name=amount]")?.focus();
    }
  }, [pending, error]);

  return (
    <form
      ref={form}
      action={(fd) => {
        submitted.current = true;
        return action(fd);
      }}
      className="card space-y-3"
    >
      <h2 className="text-base">Lançar despesa</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">Categoria</label>
          <select id="category" name="category" required className="input" defaultValue="">
            <option value="" disabled>Escolha...</option>
            {Object.entries(EXPENSE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="amount">Valor (Bs)</label>
          <input id="amount" name="amount" inputMode="decimal" required className="input" placeholder="0" />
        </div>
        <div>
          <label className="label" htmlFor="date">Data</label>
          <input id="date" name="date" type="date" required defaultValue={defaultDate} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="method">Pago com</label>
          <select id="method" name="method" className="input" defaultValue="EFECTIVO">
            {PAYMENT_METHODS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Descrição (opcional)</label>
          <input id="description" name="description" className="input" placeholder="Ex.: leite Ninho, salário da Ana, conta de luz..." />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-coral-600">{error}</p>}
      <button disabled={pending} className="btn-accent">{pending ? "Salvando..." : "Lançar despesa"}</button>
    </form>
  );
}
