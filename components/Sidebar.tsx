"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Category = { slug: string; name: string; count: number };

const NAV = [
  { href: "/painel", label: "Visão geral", icon: "◈" },
  { href: "/painel/estoque", label: "Estoque", icon: "▦" },
  { href: "/painel/vendas/nova", label: "Nova venda", icon: "＋" },
  { href: "/painel/vendas", label: "Vendas", icon: "≡" },
  { href: "/painel/equipe", label: "Equipe", icon: "☺" },
];

export function Sidebar({
  categories,
  alerts,
  userName,
  logout,
}: {
  categories: Category[];
  alerts: number;
  userName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeCategory = params.get("categoria");
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname, activeCategory]);

  const isActive = (href: string) =>
    href === "/painel"
      ? pathname === "/painel"
      : href === "/painel/vendas"
        ? pathname === "/painel/vendas" || /^\/painel\/vendas\/(?!nova)/.test(pathname)
        : pathname.startsWith(href);

  return (
    <>
      {/* Barra superior no celular */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-creme-300 bg-creme-50/95 px-4 py-2 backdrop-blur lg:hidden">
        <Link href="/painel" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={36} height={36} className="mix-blend-multiply" />
          <span className="font-serif text-lg font-semibold">Gula dos Meninos</span>
        </Link>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3" aria-label="Abrir menu">
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-cacau-900/30 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-creme-300 bg-creme-50 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/painel" className="flex flex-col items-center border-b border-creme-300 px-4 py-4">
          <Image src="/logo.png" alt="Gula dos Meninos" width={110} height={110} priority className="mix-blend-multiply" />
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-dourado-600">
            Painel dos sócios
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4 text-sm">
          {NAV.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 font-semibold transition ${
                  isActive(item.href) && !(item.href === "/painel/estoque" && activeCategory)
                    ? "bg-cacau-900 text-creme-50"
                    : "text-cacau-700 hover:bg-creme-200"
                }`}
              >
                <span className="w-4 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.href === "/painel/estoque" && alerts > 0 && (
                  <span className="badge bg-coral-500 text-white">{alerts}</span>
                )}
              </Link>

              {item.href === "/painel/estoque" && (
                <div className="mb-2 ml-5 border-l border-creme-300 pl-2">
                  {categories.map((c) => {
                    const active = pathname === "/painel/estoque" && activeCategory === c.slug;
                    return (
                      <Link
                        key={c.slug}
                        href={`/painel/estoque?categoria=${c.slug}`}
                        className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] transition ${
                          active
                            ? "bg-creme-200 font-semibold text-cacau-900"
                            : "text-cacau-500 hover:bg-creme-200 hover:text-cacau-900"
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-xs text-cacau-400">{c.count}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-creme-300 px-4 py-3 text-sm">
          <p className="truncate font-semibold">{userName}</p>
          <form action={logout}>
            <button className="text-xs text-cacau-500 underline-offset-2 hover:underline">Sair</button>
          </form>
        </div>
      </aside>
    </>
  );
}
