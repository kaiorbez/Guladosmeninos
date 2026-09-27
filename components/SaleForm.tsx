"use client";

import { useActionState, useMemo, useState } from "react";
import { createSaleAction } from "@/app/painel/vendas/actions";

export type MenuCategory = {
  id: string;
  name: string;
  products: {
    id: string;
    name: string;
    trackStock: boolean;
    priceOnRequest: boolean;
    variants: { id: string; name: string; servings: string | null; price: number; stock: number }[];
  }[];
};

type CartLine = {
  variantId: string;
  label: string;
  quantity: number;
  price: string;
  listPrice: number;
  priceOnRequest: boolean;
  trackStock: boolean;
  stock: number;
};

const CHANNELS = [
  ["BALCAO", "Balcão"],
  ["WHATSAPP", "WhatsApp"],
  ["DELIVERY", "Delivery"],
  ["INSTAGRAM", "Instagram"],
] as const;
const PAYMENTS = [
  ["QR", "QR"],
  ["EFECTIVO", "Dinheiro"],
  ["TARJETA", "Cartão"],
  ["OTRO", "Outro"],
] as const;

const fmt = (n: number) => `Bs ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
const parsePrice = (s: string) => Number(s.replace(",", "."));

export function SaleForm({ menu }: { menu: MenuCategory[] }) {
  const [error, action, pending] = useActionState(createSaleAction, null);
  const [tab, setTab] = useState(menu[0]?.id ?? "");
  const [picking, setPicking] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState("BALCAO");
  const [payment, setPayment] = useState("QR");

  const category = menu.find((c) => c.id === tab);

  const add = (p: MenuCategory["products"][number], v: MenuCategory["products"][number]["variants"][number]) => {
    setCart((c) => {
      const existing = c.find((l) => l.variantId === v.id);
      if (existing) return c.map((l) => (l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...c,
        {
          variantId: v.id,
          label: v.name === "Único" ? p.name : `${p.name} (${v.name})`,
          quantity: 1,
          price: p.priceOnRequest ? "" : String(v.price),
          listPrice: v.price,
          priceOnRequest: p.priceOnRequest,
          trackStock: p.trackStock,
          stock: v.stock,
        },
      ];
    });
    setPicking(null);
  };

  const setQty = (id: string, q: number) =>
    setCart((c) => (q <= 0 ? c.filter((l) => l.variantId !== id) : c.map((l) => (l.variantId === id ? { ...l, quantity: q } : l))));

  const total = cart.reduce((s, l) => s + (parsePrice(l.price) || 0) * l.quantity, 0);

  const payload = useMemo(
    () =>
      JSON.stringify(
        cart.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          // Só manda o preço se foi alterado (ou é personalizado); senão vale o do cardápio.
          ...(l.priceOnRequest || parsePrice(l.price) !== l.listPrice ? { unitPrice: parsePrice(l.price) } : {}),
        })),
      ),
    [cart],
  );

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-5">
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="payment" value={payment} />

      {/* Cardápio */}
      <section className="card xl:col-span-3">
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto pb-1">
          {menu.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => { setTab(c.id); setPicking(null); }}
              className={`btn whitespace-nowrap ${tab === c.id ? "bg-cacau-900 text-creme-50" : "btn-ghost"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {category?.products.map((p) => {
            const single = p.variants.length === 1;
            const open = picking === p.id;
            const stockTotal = p.variants.reduce((s, v) => s + v.stock, 0);
            return (
              <div key={p.id} className={`rounded-xl border bg-white p-3 transition ${open ? "border-dourado-500 ring-2 ring-dourado-400/30" : "border-creme-300"}`}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => (single ? add(p, p.variants[0]) : setPicking(open ? null : p.id))}
                >
                  <p className="font-semibold leading-snug">{p.name}</p>
                  <p className="mt-1 text-xs text-cacau-500">
                    {p.priceOnRequest
                      ? "Preço a combinar"
                      : single
                        ? fmt(p.variants[0].price)
                        : `${fmt(Math.min(...p.variants.map((v) => v.price)))} a ${fmt(Math.max(...p.variants.map((v) => v.price)))}`}
                    {p.trackStock && <span className={stockTotal === 0 ? " text-coral-600" : ""}> · {stockTotal} em estoque</span>}
                  </p>
                </button>
                {open && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {p.variants.map((v) => (
                      <button type="button" key={v.id} onClick={() => add(p, v)} className="rounded-lg border border-creme-300 bg-creme-50 px-2 py-2 text-left text-sm hover:border-dourado-500">
                        <span className="font-semibold">{v.name}</span> · {fmt(v.price)}
                        {v.servings && <span className="block text-[11px] text-cacau-400">{v.servings}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Pedido */}
      <section className="card h-fit xl:sticky xl:top-6 xl:col-span-2">
        <h2 className="text-xl">Pedido</h2>
        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-cacau-500">Toque nos produtos ao lado para adicionar.</p>
        ) : (
          <ul className="mt-3 divide-y divide-creme-200">
            {cart.map((l) => {
              const over = l.trackStock && l.quantity > l.stock;
              return (
                <li key={l.variantId} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{l.label}</p>
                    <button type="button" onClick={() => setQty(l.variantId, 0)} className="text-xs text-cacau-400 hover:text-coral-600">✕</button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => setQty(l.variantId, l.quantity - 1)} className="btn-ghost px-3 py-1">−</button>
                    <span className="w-6 text-center font-semibold">{l.quantity}</span>
                    <button type="button" onClick={() => setQty(l.variantId, l.quantity + 1)} className="btn-ghost px-3 py-1">+</button>
                    <span className="ml-auto text-xs text-cacau-400">Bs</span>
                    <input
                      value={l.price}
                      onChange={(e) => setCart((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, price: e.target.value } : x)))}
                      inputMode="decimal"
                      placeholder={l.priceOnRequest ? "combinado" : ""}
                      aria-label="Preço unitário"
                      className={`input w-24 text-right ${l.priceOnRequest && !l.price ? "border-coral-400" : ""}`}
                    />
                  </div>
                  {over && <p className="mt-1 text-xs text-coral-600">Só há {l.stock} em estoque.</p>}
                  {!l.priceOnRequest && parsePrice(l.price) !== l.listPrice && (
                    <p className="mt-1 text-xs text-dourado-600">Preço do cardápio: {fmt(l.listPrice)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 space-y-4 border-t border-creme-300 pt-4">
          <div>
            <span className="label">Canal</span>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(([v, l]) => (
                <button type="button" key={v} onClick={() => setChannel(v)} className={`btn py-1.5 ${channel === v ? "bg-cacau-900 text-creme-50" : "btn-ghost"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Pagamento</span>
            <div className="flex flex-wrap gap-2">
              {PAYMENTS.map(([v, l]) => (
                <button type="button" key={v} onClick={() => setPayment(v)} className={`btn py-1.5 ${payment === v ? "bg-cacau-900 text-creme-50" : "btn-ghost"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="customerName" placeholder="Cliente (opcional)" className="input" />
            <input name="customerPhone" placeholder="Telefone (opcional)" className="input" />
          </div>
          <input name="notes" placeholder="Observação: entrega, retirada, decoração..." className="input" />

          <div className="flex items-center justify-between">
            <span className="text-sm text-cacau-500">Total</span>
            <span className="font-serif text-3xl font-semibold">{fmt(total)}</span>
          </div>
          {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}
          <button type="submit" disabled={pending || cart.length === 0} className="btn-accent w-full py-3 text-base">
            {pending ? "Registrando..." : "Registrar venda"}
          </button>
        </div>
      </section>
    </form>
  );
}
