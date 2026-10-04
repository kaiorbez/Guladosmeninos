"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveOrderAction } from "@/app/painel/encomendas/actions";
import { ORDER_CHANNELS, PAYMENT_METHODS } from "@/lib/format";
import { resizeImage } from "@/lib/resize-image";

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
  channel: string;
  /** URL da foto da decoração já salva (edição). */
  decorationPhotoUrl?: string | null;
};

type Suggestions = { product: string[]; dough: string[]; filling: string[]; topping: string[] };

const CHANNELS = ORDER_CHANNELS;
const METHODS = PAYMENT_METHODS;

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
  const editing = Boolean(values.id);
  const [error, action, pending] = useActionState(saveOrderAction, null);
  const [immediate, setImmediate] = useState(values.deliveryTime === "AGORA");
  const [date, setDate] = useState(values.deliveryDate);
  const [total, setTotal] = useState(values.total);
  const [paid, setPaid] = useState(values.paid);
  const missing = Math.max(parse(total) - parse(paid), 0);
  const [photo, setPhoto] = useState(""); // nova foto (data URL)
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const shownPhoto = photo || (!removePhoto ? values.decorationPhotoUrl : null);

  const field = (
    name: keyof OrderValues,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    options?: string[],
  ) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={values[name] ?? ""} className="input" list={options ? `sugestoes-${name}` : undefined} {...props} />
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
          <div>
            <label className="label" htmlFor="deliveryTime">Horário de entrega</label>
            <input id="deliveryTime" name="deliveryTime" type="time" defaultValue={values.deliveryTime === "AGORA" ? "" : values.deliveryTime} disabled={immediate} className="input" />
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="paraAgora" value="1" checked={immediate} onChange={e=>setImmediate(e.target.checked)} />Para agora</label>
          </div>
          {field("customerName", "Cliente", { required: true })}
          {field("customerPhone", "Celular", { inputMode: "tel" })}
          <div>
            <label className="label" htmlFor="channel">Pedido feito por</label>
            <select id="channel" name="channel" defaultValue={values.channel} className="input">
              {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-base">Pedido</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="product">Produtos</label>
            <textarea
              id="product"
              name="product"
              required
              rows={3}
              defaultValue={values.product}
              className="input"
              placeholder={"Digite os produtos, um por linha. Ex.:\n1 Naked Cake P\n50 docinhos"}
            />
          </div>
          {field("dough", "Massa", { placeholder: "Ex.: chocolate" }, suggestions.dough)}
          {field("filling", "Recheio", { placeholder: "Ex.: maracujá" }, suggestions.filling)}
          {field("topping", "Cobertura", {}, suggestions.topping)}
          <div>
            {field("decoration", "Decoração", { placeholder: "Ex.: modelo 10" })}
            <input type="hidden" name="decorationPhoto" value={photo} />
            <input type="hidden" name="decorationPhotoRemove" value={removePhoto ? "1" : ""} />
            <div className="mt-2 flex items-center gap-3">
              {shownPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownPhoto} alt="Foto da decoração" className="h-16 w-16 rounded-lg border border-creme-300 object-cover" />
              )}
              <label className="btn-ghost cursor-pointer px-2.5 py-1 text-xs">
                📷 {shownPhoto ? "Trocar foto" : "Foto da decoração"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      setPhotoError("");
                      setPhoto(await resizeImage(file));
                      setRemovePhoto(false);
                    } catch (err) {
                      setPhotoError((err as Error).message);
                    }
                  }}
                />
              </label>
              {shownPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setPhoto("");
                    setRemovePhoto(true);
                  }}
                  className="text-xs text-cacau-500 hover:text-coral-600 hover:underline"
                >
                  remover
                </button>
              )}
            </div>
            {photoError && <p className="mt-1 text-xs text-coral-600">{photoError}</p>}
          </div>
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
          {editing ? (
            <div>
              <span className="label">Já pago</span>
              <p className="py-1.5 text-xl font-semibold tabular-nums">{fmt(parse(paid))}</p>
              <p className="text-xs text-cacau-500">Os pagamentos ficam no quadro abaixo.</p>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="paid">Sinal pago (Bs)</label>
              <input id="paid" name="paid" value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className="input" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPaid(String(parse(total) / 2))} className="btn-ghost px-2.5 py-1 text-xs">Metade</button>
                <button type="button" onClick={() => setPaid(total)} className="btn-ghost px-2.5 py-1 text-xs">Tudo</button>
                <select name="paidMethod" aria-label="Forma de pagamento do sinal" className="input w-auto px-2 py-1 text-xs">
                  {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          )}
          <div>
            <span className="label">Falta</span>
            <p className={`py-1.5 text-xl font-semibold tabular-nums ${missing > 0 ? "text-coral-600" : ""}`}>{fmt(missing)}</p>
          </div>
        </div>
      </section>

      {error && <p className="text-sm font-medium text-coral-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-accent">
          {pending ? "Salvando..." : editing ? "Salvar alterações" : "Registrar encomenda"}
        </button>
        {!editing && (
          <button type="submit" name="next" value="outro" disabled={pending} className="btn-ghost" title="Registra esta e abre outra ficha com o mesmo cliente">
            Registrar e adicionar outro
          </button>
        )}
        <Link href="/painel/encomendas" className="btn-ghost">Voltar</Link>
      </div>
    </form>
  );
}

