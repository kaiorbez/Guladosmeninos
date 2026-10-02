"use client";

import { useActionState } from "react";
import { updatePedidosYaItem } from "./actions";

/** Edição rápida do preço de um anúncio do PedidosYa. */
export function PyPriceForm({
  id,
  price,
  listPrice,
  active,
}: {
  id: string;
  price: number;
  listPrice: number | null;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(updatePedidosYaItem, null);
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input name="price" defaultValue={price} inputMode="decimal" aria-label="Preço no PedidosYa" className="input w-20 px-2 py-1 text-right" />
      <input name="listPrice" defaultValue={listPrice ?? ""} placeholder="de" inputMode="decimal" aria-label="Preço sem desconto" title="Preço sem desconto (opcional)" className="input w-16 px-2 py-1 text-right" />
      <label className="flex items-center gap-1 text-xs text-cacau-500" title="Anúncio ativo">
        <input type="checkbox" name="active" defaultChecked={active} /> ativo
      </label>
      <button disabled={pending} className="btn-ghost px-2.5 py-1 text-xs">Salvar</button>
      {state?.ok && <span className="text-xs font-medium text-dourado-600">✓</span>}
      {state?.error && <span className="w-full text-right text-xs text-coral-600">{state.error}</span>}
    </form>
  );
}
