"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRightIcon, LogOutIcon } from "lucide-react";

export type Category = { slug: string; name: string; group: string; count: number };

const NAV = [
  { href: "/painel", label: "Visão geral" },
  { href: "/painel/vendas/nova", label: "Nova venda" },
  { href: "/painel/vendas", label: "Vendas" },
  { href: "/painel/estoque", label: "Estoque" },
  { href: "/painel/pedidosya", label: "PedidosYa" },
  { href: "/painel/equipe", label: "Equipe" },
];

const linkClass = (active: boolean) =>
  `flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[13px] leading-5 transition-colors hover:bg-creme-200 ${
    active ? "bg-creme-200 font-medium text-cacau-900" : "text-cacau-700"
  }`;

export function SidebarContent({
  categories,
  logout,
  onNavigate,
}: {
  categories: Category[];
  logout: () => Promise<void>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeCategory = params.get("categoria");
  // Grupos do estoque começam recolhidos; só abre o da categoria que está sendo vista.
  const activeGroup = categories.find((c) => c.slug === activeCategory)?.group;
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : []);
  useEffect(() => {
    if (activeGroup) setOpenGroups((g) => (g.includes(activeGroup) ? g : [...g, activeGroup]));
  }, [activeGroup]);
  const toggleGroup = (g: string) => setOpenGroups((o) => (o.includes(g) ? o.filter((x) => x !== g) : [...o, g]));
  const isOpen = (g: string) => openGroups.includes(g);

  const isActive = (href: string) =>
    href === "/painel"
      ? pathname === "/painel"
      : href === "/painel/vendas"
        ? pathname === "/painel/vendas"
        : href === "/painel/estoque"
          ? pathname.startsWith(href) && !activeCategory
          : pathname.startsWith(href);

  const groups = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col bg-creme-50 text-cacau-900">
      <Link href="/painel" onClick={onNavigate} className="flex h-14 shrink-0 items-center gap-2.5 border-b border-creme-300 px-4">
        <Image src="/logo.png" alt="" width={32} height={32} priority className="rounded-full" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">Gula dos Meninos</span>
          <span className="block text-[11px] text-cacau-500">Painel</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-2" aria-label="Menu principal">
        <div>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(isActive(item.href))}>
              {item.label}
            </Link>
          ))}
        </div>

        {Object.entries(groups).map(([group, cats]) => (
          <div key={group}>
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-cacau-500 hover:text-cacau-900"
              aria-expanded={isOpen(group)}
            >
              <span>{group}</span>
              <ChevronRightIcon className={`size-3.5 transition-transform ${isOpen(group) ? "rotate-90" : ""}`} />
            </button>
            {isOpen(group) && (
              <div className="mt-0.5 pl-2">
                {cats.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/painel/estoque?categoria=${c.slug}`}
                    onClick={onNavigate}
                    className={linkClass(pathname === "/painel/estoque" && activeCategory === c.slug)}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-cacau-500">{c.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <form action={logout} className="border-t border-creme-300 p-3">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-cacau-700 transition-colors hover:bg-creme-200 hover:text-cacau-900">
          <LogOutIcon className="size-4" />
          Sair
        </button>
      </form>
    </div>
  );
}
