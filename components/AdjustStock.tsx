"use client";

import { useActionState } from "react";
import { moveStockAction } from "@/app/painel/estoque/actions";

/** Contagem manual: informa quanto há de verdade e o sistema ajusta a diferença. */
export function AdjustStock({ variantId, label, current }: { variantId: string; label: string; current: number }) {
  const [state, action, pending] = useActionState(moveStockAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 py-2">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="type" value="AJUSTE" />
      <span className="w-36 text-sm font-medium">{label}</span>
      <span className="w-24 text-xs text-cacau-400">sistema: {current}</span>
      <input name="quantity" type="number" min={0} step={1} required placeholder="contei" className="input w-24" />
      <input name="note" placeholder="observação (opcional)" className="input w-48" />
      <button disabled={pending} className="btn-ghost">Ajustar</button>
      {state?.error && <span className="text-xs text-coral-600">{state.error}</span>}
      {state?.ok && <span className="text-xs text-dourado-600">{state.ok}</span>}
    </form>
  );
}
