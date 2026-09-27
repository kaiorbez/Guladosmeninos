"use client";

import { useActionState, useEffect, useRef } from "react";
import { moveStockAction } from "@/app/painel/estoque/actions";

/** Entrada / saída rápida de estoque direto na lista. */
export function StockControl({ variantId }: { variantId: string }) {
  const [state, action, pending] = useActionState(moveStockAction, null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok && input.current) input.current.value = "";
  }, [state]);

  return (
    <form
      action={action}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="variantId" value={variantId} />
      <div className="flex items-center gap-1">
        <input
          ref={input}
          name="quantity"
          type="number"
          min={1}
          step={1}
          required
          placeholder="qtd"
          aria-label="Quantidade"
          className="input w-16 px-2 py-1 text-center"
        />
        <button name="type" value="ENTRADA" disabled={pending} title="Produzi / entrou" className="btn bg-cacau-700 px-2.5 py-1 text-white hover:bg-cacau-900">
          +
        </button>
        <button name="type" value="SAIDA" disabled={pending} title="Perda / saída sem venda" className="btn bg-coral-500 px-2.5 py-1 text-white hover:bg-coral-600">
          −
        </button>
      </div>
      {state?.error && <p className="max-w-[16rem] text-right text-xs text-coral-600">{state.error}</p>}
    </form>
  );
}
