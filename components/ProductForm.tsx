"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState, useState } from "react";
import { saveProductAction } from "@/app/painel/estoque/actions";
import { resizeImage } from "@/lib/resize-image";

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
  onStore: boolean;
  active: boolean;
  image: string | null;
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
  const [photo, setPhoto] = useState<string>("");
  const [photoError, setPhotoError] = useState("");
  const [variants, setVariants] = useState<Variant[]>(() =>
    initial.variants.map((v) => ({ ...v, key: v.id ?? newKey() })),
  );

  const update = (key: string, patch: Partial<Variant>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));


  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="variantCount" value={variants.length} />
      <input type="hidden" name="photoData" value={photo} />

      <div className="card grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          {photo || initial.image ? (
            <img src={photo || initial.image!} alt="" className="thumb h-40 w-40" />
          ) : (
            <div className="thumb flex h-40 w-40 items-center justify-center text-center text-xs font-medium text-cacau-400">
              Sem foto
            </div>
          )}
          <label className="btn-ghost cursor-pointer py-1.5 text-xs">
            {photo || initial.image ? "Trocar foto" : "Enviar foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setPhotoError("");
                  setPhoto(await resizeImage(file));
                } catch (err) {
                  setPhotoError((err as Error).message);
                }
              }}
            />
          </label>
          {photo && <span className="text-[11px] font-medium text-dourado-600">Salve para aplicar</span>}
          {photoError && <span className="text-[11px] font-medium text-coral-600">{photoError}</span>}
        </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            Pronta entrega (não vende sem estoque)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="priceOnRequest" defaultChecked={initial.priceOnRequest} />
            Preço sob consulta (personalizada)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="onStore" defaultChecked={initial.onStore} />
            Vende no WhatsApp (preço próprio)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={initial.active} />
            Ativo
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Descrição (o agente do WhatsApp usa este texto)</label>
          <textarea id="description" name="description" defaultValue={initial.description} rows={3} className="input" />
        </div>
      </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base">Tamanhos e preços</h2>
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
                <th>Preço WhatsApp (Bs)</th>
                <th>Ativo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                return (
                  <tr key={v.key}>
                    <td>
                      {v.id && <input type="hidden" name={`v${i}.id`} value={v.id} />}
                      {/* custo e estoque mínimo não aparecem mais, mas o valor salvo é mantido */}
                      <input type="hidden" name={`v${i}.cost`} value={v.cost} />
                      <input type="hidden" name={`v${i}.minStock`} value={v.minStock} />
                      <input name={`v${i}.name`} value={v.name} onChange={(e) => update(v.key, { name: e.target.value })} placeholder="P, M, G, Único..." className="input min-w-[6rem]" />
                    </td>
                    <td>
                      <input name={`v${i}.servings`} value={v.servings} onChange={(e) => update(v.key, { servings: e.target.value })} placeholder="até 15 pessoas" className="input min-w-[9rem]" />
                    </td>
                    <td>
                      <input name={`v${i}.price`} value={v.price} onChange={(e) => update(v.key, { price: e.target.value })} inputMode="decimal" className="input w-24" />
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
          O preço do PedidosYa é definido na aba PedidosYa. Tamanhos já vendidos não podem ser apagados, só desativados.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : "Salvar produto"}
        </button>
        {state?.error && <p className="text-sm font-medium text-coral-600">{state.error}</p>}
        {state?.ok && <p className="text-sm font-medium text-dourado-600">{state.ok}</p>}
      </div>
    </form>
  );
}
