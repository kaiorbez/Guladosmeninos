"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Category = { slug: string; name: string; group: string; count: number };

const NAV = [
  { href: "/painel", label: "Visão geral", icon: "◈" },
  { href: "/painel/vendas/nova", label: "Nova venda", icon: "＋" },
  { href: "/painel/vendas", label: "Vendas", icon: "≡" },
  { href: "/painel/estoque", label: "Estoque", icon: "▦" },
  { href: "/painel/pedidosya", label: "PedidosYa", icon: "◉" },
  { href: "/painel/equipe", label: "Equipe", icon: "☺" },
];

export function Sidebar({
  categories,
  logout,
}: {
  categories: Category[];
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeCategory = params.get("categoria");
  const [open, setOpen] = useState(false);
  // Tópicos recolhidos no menu (lembrados neste navegador).
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setClosed(JSON.parse(localStorage.getItem("menu-recolhido") ?? "[]"));
    } catch {}
  }, []);
  const toggleGroup = (g: string) =>
    setClosed((c) => {
      const next = c.includes(g) ? c.filter((x) => x !== g) : [...c, g];
      try {
        localStorage.setItem("menu-recolhido", JSON.stringify(next));
      } catch {}
      return next;
    });

  useEffect(() => setOpen(false), [pathname, activeCategory]);

  const isActive = (href: string) =>
    href === "/painel"
      ? pathname === "/painel"
      : href === "/painel/vendas"
        ? pathname === "/painel/vendas"
        : pathname.startsWith(href);

  const groups = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <>
      {/* Barra superior no celular */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-creme-300 bg-creme-50/95 px-4 py-2 backdrop-blur lg:hidden">
        <Link href="/painel" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={36} height={36} className="rounded-full" />
          <span className="text-base font-extrabold">Painel Gula dos Meninos</span>
        </Link>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3" aria-label="Abrir menu">
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-cacau-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-creme-300 bg-creme-50 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/painel" className="flex items-center gap-3 border-b border-creme-300 px-5 py-4">
          <Image src="/logo.png" alt="Gula dos Meninos" width={56} height={56} priority className="rounded-full ring-2 ring-dourado-500/60" />
          <span className="leading-tight">
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-dourado-600">Painel</span>
            <span className="block text-lg font-extrabold">Gula dos Meninos</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4 text-sm">
          {NAV.map((item) => {
            const active = isActive(item.href) && !(item.href === "/painel/estoque" && activeCategory);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition ${
                    active ? "bg-cacau-900 text-white shadow-sm" : "text-cacau-700 hover:bg-creme-200 hover:text-cacau-900"
                  }`}
                >
                  <span className={`w-4 text-center ${item.href === "/painel/pedidosya" && !active ? "text-pedidosya" : ""}`}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </Link>

                {item.href === "/painel/estoque" && (
                  <div className="mb-3 ml-5 border-l border-creme-300 pl-2">
                    {Object.entries(groups).map(([group, cats]) => (
                      <div key={group} className="mt-2">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group)}
                          className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-dourado-600 hover:text-cacau-900"
                          aria-expanded={!closed.includes(group)}
                        >
                          <span>{group}</span>
                          <span className={`text-[10px] transition-transform ${closed.includes(group) ? "" : "rotate-90"}`}>▶</span>
                        </button>
                        {!closed.includes(group) && cats.map((c) => {
                          const on = pathname === "/painel/estoque" && activeCategory === c.slug;
                          return (
                            <Link
                              key={c.slug}
                              href={`/painel/estoque?categoria=${c.slug}`}
                              className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                                on ? "bg-dourado-400/25 text-cacau-900" : "text-cacau-700 hover:bg-creme-200 hover:text-cacau-900"
                              }`}
                            >
                              <span>{c.name}</span>
                              <span className="text-xs text-cacau-400">{c.count}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <form action={logout} className="border-t border-creme-300 px-3 py-3">
          <button className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-cacau-700 hover:bg-creme-200 hover:text-coral-600">
            ⎋ Sair
          </button>
        </form>
      </aside>
    </>
  );
}
