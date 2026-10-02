"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setVariantPriceAction } from "@/app/painel/estoque/actions";

const fmt = (n: number) => `Bs ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

/** Preço clicável: vira um campo para editar e salvar na hora (Enter salva, Esc cancela). */
export function PriceEdit({ variantId, price }: { variantId: string; price: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(price));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await setVariantPriceAction(variantId, value);
      if (r?.error) return setError(r.error);
      setError("");
      setEditing(false);
      router.refresh();
    });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(price));
          setEditing(true);
        }}
        title="Clique para alterar o preço"
        className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium hover:bg-creme-200"
      >
        {fmt(price)}
        <span className="text-xs text-cacau-400 group-hover:text-cacau-900">✎</span>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-cacau-500">Bs</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          inputMode="decimal"
          aria-label="Novo preço"
          className="input w-20 px-2 py-1 text-right"
        />
        <button type="button" onClick={save} disabled={pending} className="btn-primary px-2 py-1 text-xs" title="Salvar">
          {pending ? "…" : "✓"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost px-2 py-1 text-xs" title="Cancelar">
          ✕
        </button>
      </span>
      {error && <span className="text-xs text-coral-600">{error}</span>}
    </span>
  );
}
