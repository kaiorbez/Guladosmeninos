"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BikeIcon,
  CakeSliceIcon,
  ChevronRightIcon,
  ContactIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PackageIcon,
  ReceiptIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type Category = { slug: string; name: string; group: string; count: number };

type NavItem = { href: string; label: string; icon: LucideIcon };

// Menu separado por tópicos; os grupos do cardápio ficam dentro de "Estoque".
const SECTIONS: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/painel", label: "Visão geral", icon: LayoutDashboardIcon }] },
  {
    title: "Vendas",
    items: [
      { href: "/painel/vendas", label: "Vendas", icon: ReceiptIcon },
      { href: "/painel/encomendas", label: "Encomendas", icon: CakeSliceIcon },
      { href: "/painel/pedidosya", label: "PedidosYa", icon: BikeIcon },
      { href: "/painel/clientes", label: "Clientes", icon: ContactIcon },
    ],
  },
  { title: "Estoque", items: [{ href: "/painel/estoque", label: "Todos os produtos", icon: PackageIcon }] },
  {
    title: "Administração",
    items: [
      { href: "/painel/financeiro", label: "Financeiro (DRE)", icon: LandmarkIcon },
      { href: "/painel/equipe", label: "Equipe", icon: UsersIcon },
    ],
  },
];

const linkClass = (active: boolean) =>
  `flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] leading-5 transition-colors hover:bg-creme-200 ${
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
      : href === "/painel/estoque"
        ? pathname.startsWith(href) && !activeCategory
        : pathname.startsWith(href);

  const groups = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col bg-creme-50 text-cacau-900">
      <Link href="/painel" onClick={onNavigate} className="flex shrink-0 items-center gap-3 border-b border-creme-300 px-4 py-4">
        <Image src="/logo.png" alt="" width={64} height={64} priority className="shrink-0 rounded-full" />
        <span className="min-w-0 leading-tight">
          <span className="block text-[15px] font-semibold">Gula dos Meninos</span>
          <span className="block text-xs text-cacau-500">Painel</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Menu principal">
        {SECTIONS.map((section) => (
          <div key={section.title ?? "geral"}>
            {section.title && (
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-cacau-400">{section.title}</p>
            )}
            {section.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={onNavigate} className={linkClass(isActive(href))}>
                <Icon className="size-4 shrink-0 text-cacau-500" />
                {label}
              </Link>
            ))}

            {section.title === "Estoque" &&
              Object.entries(groups).map(([group, cats]) => (
                <div key={group}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-5 text-cacau-700 transition-colors hover:bg-creme-200"
                    aria-expanded={isOpen(group)}
                  >
                    <ChevronRightIcon className={`size-4 shrink-0 text-cacau-400 transition-transform ${isOpen(group) ? "rotate-90" : ""}`} />
                    <span className="flex-1">{group}</span>
                    <span className="text-[11px] tabular-nums text-cacau-400">{cats.reduce((s, c) => s + c.count, 0)}</span>
                  </button>
                  {isOpen(group) && (
                    <div className="ml-4 border-l border-creme-300 pl-2">
                      {cats.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/painel/estoque?categoria=${c.slug}`}
                          onClick={onNavigate}
                          className={`${linkClass(pathname === "/painel/estoque" && activeCategory === c.slug)} justify-between py-1`}
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-cacau-400">{c.count}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
