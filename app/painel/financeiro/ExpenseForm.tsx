"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PAYMENT_METHODS } from "@/lib/format";
import { addExpenseAction } from "./actions";
import { EXPENSE_HINT, EXPENSE_LABEL } from "./labels";

/** Lançar uma despesa (aluguel, fornecedor, funcionário, energia, outros). */
export function ExpenseForm({ defaultDate }: { defaultDate: string }) {
  const [error, action, pending] = useActionState(addExpenseAction, null);
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const [category, setCategory] = useState("");
  const isOther = category === "OUTROS";

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
          <select id="category" name="category" required className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
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
          <label className="label" htmlFor="description">
            {isOther ? "Título do lançamento (o que é?)" : "Título (opcional)"}
          </label>
          <input
            id="description"
            name="description"
            required={isOther}
            maxLength={200}
            className={`input ${isOther ? "border-dourado-500" : ""}`}
            placeholder={EXPENSE_HINT[category] ?? "Ex.: leite Ninho, salário da Ana, conta de luz..."}
          />
          {isOther && <p className="mt-1 text-xs text-cacau-500">Em “Outros”, o título aparece no DRE para saber do que é cada gasto.</p>}
        </div>
      </div>
      {error && <p className="text-sm font-medium text-coral-600">{error}</p>}
      <button disabled={pending} className="btn-accent">{pending ? "Salvando..." : "Lançar despesa"}</button>
    </form>
  );
}
