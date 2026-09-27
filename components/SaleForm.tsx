"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState, useMemo, useState } from "react";
import { createSaleAction } from "@/app/painel/vendas/actions";

export type MenuItem = {
  /** Chave do item no catálogo (variante na loja, anúncio no PedidosYa). */
  key: string;
  variantId: string;
  label: string;
  size: string | null;
  servings: string | null;
  price: number;
  priceOnRequest: boolean;
  trackStock: boolean;
  stock: number;
  image: string | null;
};
export type MenuProduct = { id: string; name: string; image: string | null; items: MenuItem[] };
export type MenuSection = { id: string; name: string; products: MenuProduct[] };

type CartLine = MenuItem & { quantity: number; priceInput: string };

const CHANNELS = [
  ["BALCAO", "Balcão"],
  ["WHATSAPP", "WhatsApp"],
  ["DELIVERY", "Delivery"],
  ["INSTAGRAM", "Instagram"],
  ["PEDIDOSYA", "PedidosYa"],
] as const;
const PAYMENTS = [
  ["QR", "QR"],
  ["EFECTIVO", "Dinheiro"],
  ["TARJETA", "Cartão"],
  ["OTRO", "Outro"],
] as const;

const fmt = (n: number) => `Bs ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
const parsePrice = (s: string) => Number(s.replace(",", "."));

function Photo({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  return src ? (
    <img src={src} alt={alt} className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-creme-200 text-2xl font-extrabold text-dourado-600 ${className}`}>
      {alt.replace(/^(Torta|Pote|Fatia|Combo|Vela)\s+/i, "").charAt(0)}
    </div>
  );
}

export function SaleForm({
  store,
  pedidosYa,
  initialChannel,
}: {
  store: MenuSection[];
  pedidosYa: MenuSection[];
  initialChannel: string;
}) {
  const [error, action, pending] = useActionState(createSaleAction, null);
  const [channel, setChannel] = useState(initialChannel);
  const isPy = channel === "PEDIDOSYA";
  const menu = isPy ? pedidosYa : store;
  const [tab, setTab] = useState(menu[0]?.id ?? "");
  const [picking, setPicking] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("QR");
  const [cartOpen, setCartOpen] = useState(true);

  const section = menu.find((c) => c.id === tab) ?? menu[0];

  const switchChannel = (c: string) => {
    const toPy = c === "PEDIDOSYA";
    if (toPy !== isPy) {
      // Troca de cardápio: os preços mudam, então o pedido recomeça.
      setCart([]);
      setTab((toPy ? pedidosYa : store)[0]?.id ?? "");
      setPicking(null);
    }
    setChannel(c);
  };

  const add = (item: MenuItem) => {
    setCart((c) => {
      const existing = c.find((l) => l.key === item.key);
      if (existing) return c.map((l) => (l.key === item.key ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { ...item, quantity: 1, priceInput: item.priceOnRequest ? "" : String(item.price) }];
    });
    setPicking(null);
  };

  const setQty = (key: string, q: number) =>
    setCart((c) => (q <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, quantity: q } : l))));

  const total = cart.reduce((s, l) => s + (parsePrice(l.priceInput) || 0) * l.quantity, 0);

  const payload = useMemo(
    () =>
      JSON.stringify(
        cart.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          // No PedidosYa o preço é sempre o do app; na loja só vai se foi alterado.
          ...(isPy || l.priceOnRequest || parsePrice(l.priceInput) !== l.price ? { unitPrice: parsePrice(l.priceInput) } : {}),
        })),
      ),
    [cart, isPy],
  );

  return (
    <form action={action} className="flex flex-col items-start gap-6 xl:flex-row">
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="payment" value={payment} />

      <section className="card w-full min-w-0 flex-1">
        <span className="label">Onde foi a venda?</span>
        <div className="mb-5 flex flex-wrap gap-2">
          {CHANNELS.map(([v, l]) => (
            <button
              type="button"
              key={v}
              onClick={() => switchChannel(v)}
              className={`btn py-1.5 ${
                channel === v ? (v === "PEDIDOSYA" ? "bg-pedidosya text-white" : "btn-on") : "btn-ghost"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {isPy && (
          <p className="mb-4 rounded-xl border border-pedidosya/40 bg-pedidosya/10 px-3 py-2 text-xs font-bold text-[#C8003F]">
            Cardápio e preços do PedidosYa (com a taxa do app).
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-1.5">
          {menu.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => {
                setTab(c.id);
                setPicking(null);
              }}
              className={`btn px-3 py-1.5 text-[13px] ${section?.id === c.id ? "btn-primary" : "btn-ghost"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {section?.products.map((p) => {
            const single = p.items.length === 1;
            const open = picking === p.id;
            const tracked = p.items.some((i) => i.trackStock);
            const stockTotal = p.items.reduce((s, i) => s + i.stock, 0);
            const prices = p.items.map((i) => i.price);
            return (
              <div
                key={p.id}
                className={`overflow-hidden rounded-xl border bg-white transition ${
                  open ? "border-dourado-500 ring-2 ring-dourado-400/40" : "border-creme-300 hover:border-dourado-500/60"
                }`}
              >
                <button type="button" className="block w-full text-left" onClick={() => (single ? add(p.items[0]) : setPicking(open ? null : p.id))}>
                  <Photo src={p.image} alt={p.name} className="aspect-square w-full" />
                  <div className="p-2">
                    <p className="line-clamp-2 text-[13px] font-bold leading-tight">{p.name}</p>
                    <p className="mt-0.5 text-xs font-bold text-dourado-600">
                      {p.items[0].priceOnRequest
                        ? "Preço a combinar"
                        : single
                          ? fmt(prices[0])
                          : `${fmt(Math.min(...prices))} a ${fmt(Math.max(...prices))}`}
                    </p>
                    {tracked ? (
                      <p className={`text-[11px] font-bold ${"text-cacau-500"}`}>
                        {stockTotal === 0 ? "sem estoque" : `${stockTotal} em estoque`}
                      </p>
                    ) : (
                      <p className="text-[11px] font-bold text-cacau-500">{stockTotal > 0 ? `${stockTotal} prontas` : "sob encomenda"}</p>
                    )}
                  </div>
                </button>
                {open && (
                  <div className="grid gap-1.5 border-t border-creme-300 p-2">
                    {p.items.map((i) => (
                      <button
                        type="button"
                        key={i.key}
                        onClick={() => add(i)}
                        className="rounded-lg border border-creme-300 bg-creme-50 px-2 py-1.5 text-left text-xs hover:border-dourado-500"
                      >
                        <span className="font-bold">{i.size ?? i.label}</span> · {fmt(i.price)}
                        {i.servings && <span className="block text-[11px] text-cacau-400">{i.servings}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {!cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="btn-primary fixed bottom-5 right-5 z-20 px-5 py-3 text-base shadow-xl"
        >
          🛒 Pedido · {cart.reduce((n, l) => n + l.quantity, 0)} item(ns) · {fmt(total)} ▲
        </button>
      )}

      <section className={`card h-fit w-full xl:sticky xl:top-6 xl:w-[360px] xl:shrink-0 ${cartOpen ? "" : "hidden"}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Pedido</h2>
          <button type="button" onClick={() => setCartOpen(false)} className="btn-ghost px-3 py-1 text-xs" title="Recolher o pedido">
            Recolher ▶
          </button>
        </div>
        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-cacau-500">Toque nos produtos para adicionar.</p>
        ) : (
          <ul className="mt-3 divide-y divide-creme-300">
            {cart.map((l) => {
              const over = l.trackStock && l.quantity > l.stock;
              return (
                <li key={l.key} className="flex gap-3 py-3">
                  <Photo src={l.image} alt={l.label} className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold">{l.label}</p>
                      <button type="button" onClick={() => setQty(l.key, 0)} className="text-xs text-cacau-400 hover:text-coral-600" aria-label="Remover">✕</button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" onClick={() => setQty(l.key, l.quantity - 1)} className="btn-ghost px-3 py-1">−</button>
                      <span className="w-6 text-center font-bold">{l.quantity}</span>
                      <button type="button" onClick={() => setQty(l.key, l.quantity + 1)} className="btn-ghost px-3 py-1">+</button>
                      <span className="ml-auto text-xs text-cacau-400">Bs</span>
                      <input
                        value={l.priceInput}
                        onChange={(e) => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, priceInput: e.target.value } : x)))}
                        inputMode="decimal"
                        placeholder={l.priceOnRequest ? "combinado" : ""}
                        aria-label="Preço unitário"
                        className={`input w-24 text-right ${l.priceOnRequest && !l.priceInput ? "border-coral-400" : ""}`}
                      />
                    </div>
                    {over && <p className="mt-1 text-xs font-bold text-coral-600">Só há {l.stock} em estoque.</p>}
                    {!l.trackStock && l.stock > 0 && (
                      <p className="mt-1 text-xs text-cacau-500">
                        {Math.min(l.stock, l.quantity)} pronta(s){l.quantity > l.stock ? `, ${l.quantity - l.stock} por encomenda` : ""}
                      </p>
                    )}
                    {!l.priceOnRequest && parsePrice(l.priceInput) !== l.price && (
                      <p className="mt-1 text-xs text-dourado-600">Preço do cardápio: {fmt(l.price)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 space-y-4 border-t border-creme-300 pt-4">
          <div>
            <span className="label">Pagamento</span>
            <div className="flex flex-wrap gap-2">
              {PAYMENTS.map(([v, l]) => (
                <button type="button" key={v} onClick={() => setPayment(v)} className={`btn py-1.5 ${payment === v ? "btn-on" : "btn-ghost"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="customerName" placeholder="Cliente (opcional)" className="input" />
            <input name="customerPhone" placeholder="Telefone (opcional)" className="input" />
          </div>
          <input name="notes" placeholder="Observação: entrega, retirada, decoração..." className="input" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-cacau-500">Total</span>
            <span className="text-3xl font-extrabold">{fmt(total)}</span>
          </div>
          {error && <p className="text-sm font-bold text-coral-600">{error}</p>}
          <button type="submit" disabled={pending || cart.length === 0} className="btn-accent w-full py-3 text-base">
            {pending ? "Registrando..." : "Registrar venda"}
          </button>
        </div>
      </section>
    </form>
  );
}
