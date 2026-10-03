"use client";

import Link from "next/link";
import { useActionState } from "react";
import { moveStockAction } from "@/app/painel/estoque/actions";

/** Cada clique movimenta uma unidade; contagens maiores ficam na edição do produto. */
export function StockControl({ variantId, productId, stock }: { variantId: string; productId: string; stock: number }) {
  const [state, action, pending] = useActionState(moveStockAction, null);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action} className="flex items-center gap-1" aria-busy={pending}>
        <input type="hidden" name="variantId" value={variantId} />
        <input type="hidden" name="quantity" value="1" />
        <button
          type="submit"
          name="type"
          value="ENTRADA"
          disabled={pending}
          aria-label="Adicionar uma unidade ao estoque"
          title="Adicionar 1 unidade"
          className="btn bg-primary px-2.5 py-1 text-primary-fg hover:bg-primary/90"
        >
          +
        </button>
        <button
          type="submit"
          name="type"
          value="SAIDA"
          disabled={pending || stock === 0}
          aria-label="Retirar uma unidade do estoque"
          title={stock === 0 ? "Estoque zerado" : "Retirar 1 unidade (perda ou saída sem venda)"}
          className="btn bg-coral-500 px-2.5 py-1 text-white hover:bg-coral-600"
        >
          −
        </button>
      </form>
      <Link href={`/painel/estoque/${productId}#ajuste-estoque`} className="text-xs text-cacau-500 hover:text-dourado-600 hover:underline">
        Ajustar estoque
      </Link>
      <div role="status" aria-live="polite">
        {pending ? (
          <p className="text-xs text-cacau-500">Salvando…</p>
        ) : state?.error ? (
          <p className="max-w-[16rem] text-right text-xs text-coral-600">{state.error}</p>
        ) : state?.ok ? (
          <p className="text-xs text-dourado-600">{state.ok}</p>
        ) : null}
      </div>
    </div>
  );
}
