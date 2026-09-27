"use client";

import { useActionState, useState } from "react";
import { saveProductAction } from "@/app/painel/estoque/actions";

type Variant = {
  id?: string;
  key: string;
  name: string;
  servings: string;
  price: string;
  cost: string;
  minStock: string;
  active: boolean;
};

export type ProductFormData = {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  trackStock: boolean;
  priceOnRequest: boolean;
  active: boolean;
  variants: Omit<Variant, "key">[];
};

let seq = 0;
const newKey = () => `n${++seq}`;

export function ProductForm({
  initial,
  categories,
}: {
  initial: ProductFormData;
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, null);
  const [variants, setVariants] = useState<Variant[]>(() =>
    initial.variants.map((v) => ({ ...v, key: v.id ?? newKey() })),
  );

  const update = (key: string, patch: Partial<Variant>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const margin = (v: Variant) => {
    const price = Number(v.price.replace(",", "."));
    const cost = Number(v.cost.replace(",", "."));
    if (!(price > 0) || !(cost > 0)) return null;
    return Math.round(((price - cost) / price) * 100);
  };

  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="variantCount" value={variants.length} />

      <div className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Nome do produto</label>
          <input id="name" name="name" defaultValue={initial.name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="categoryId">Categoria</label>
          <select id="categoryId" name="categoryId" defaultValue={initial.categoryId} required className="input">
            <option value="">Escolha...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="trackStock" defaultChecked={initial.trackStock} />
            Controlar estoque (pronta entrega)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="priceOnRequest" defaultChecked={initial.priceOnRequest} />
            Preço sob consulta (personalizada)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={initial.active} />
            Ativo no cardápio
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Descrição (o agente do WhatsApp usa este texto)</label>
          <textarea id="description" name="description" defaultValue={initial.description} rows={3} className="input" />
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">Tamanhos e preços</h2>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setVariants((vs) => [
                ...vs,
                { key: newKey(), name: "", servings: "", price: "", cost: "", minStock: "0", active: true },
              ])
            }
          >
            ＋ Tamanho
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Tamanho</th>
                <th>Serve</th>
                <th>Preço (Bs)</th>
                <th>Custo (Bs)</th>
                <th>Margem</th>
                <th>Estoque mín.</th>
                <th>Ativo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                const m = margin(v);
                return (
                  <tr key={v.key}>
                    <td>
                      {v.id && <input type="hidden" name={`v${i}.id`} value={v.id} />}
                      <input name={`v${i}.name`} value={v.name} onChange={(e) => update(v.key, { name: e.target.value })} placeholder="P, M, G, Único..." className="input min-w-[6rem]" />
                    </td>
                    <td>
                      <input name={`v${i}.servings`} value={v.servings} onChange={(e) => update(v.key, { servings: e.target.value })} placeholder="Hasta 15 personas" className="input min-w-[9rem]" />
                    </td>
                    <td>
                      <input name={`v${i}.price`} value={v.price} onChange={(e) => update(v.key, { price: e.target.value })} inputMode="decimal" className="input w-24" />
                    </td>
                    <td>
                      <input name={`v${i}.cost`} value={v.cost} onChange={(e) => update(v.key, { cost: e.target.value })} inputMode="decimal" placeholder="0" className="input w-24" />
                    </td>
                    <td className="whitespace-nowrap text-sm text-cacau-500">{m === null ? "—" : `${m}%`}</td>
                    <td>
                      <input name={`v${i}.minStock`} value={v.minStock} onChange={(e) => update(v.key, { minStock: e.target.value })} inputMode="numeric" className="input w-20" />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" name={`v${i}.active`} checked={v.active} onChange={(e) => update(v.key, { active: e.target.checked })} />
                    </td>
                    <td>
                      {!v.id && (
                        <button type="button" onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))} className="text-sm text-coral-600 hover:underline">
                          remover
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-cacau-400">
          O <b>custo</b> (ingredientes + embalagem) serve para calcular o lucro. O <b>estoque mínimo</b> dispara o alerta de reposição.
          Tamanhos já vendidos não podem ser apagados, só desativados.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : "Salvar produto"}
        </button>
        {state?.error && <p className="text-sm font-semibold text-coral-600">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-dourado-600">{state.ok}</p>}
      </div>
    </form>
  );
}
