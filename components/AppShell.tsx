"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, MoonIcon, PanelLeftIcon, SunIcon } from "lucide-react";
import { SidebarContent, type Category } from "./Sidebar";

export const SIDEBAR_COOKIE = "gula_menu_recolhido";

const SEGMENT_LABELS: Record<string, string> = {
  vendas: "Vendas",
  nova: "Nova venda",
  encomendas: "Encomendas",
  estoque: "Estoque",
  novo: "Novo produto",
  pedidosya: "PedidosYa",
  equipe: "Equipe",
  clientes: "Clientes",
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1); // sem "painel"
  return (
    <nav aria-label="Trilha" className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-cacau-500">
      {segments.length === 0 ? (
        <span className="truncate font-medium text-cacau-900">Visão geral</span>
      ) : (
        <Link href="/painel" className="hidden shrink-0 hover:text-cacau-900 sm:inline">Gula dos Meninos</Link>
      )}
      {segments.map((seg, i) => {
        const href = "/painel/" + segments.slice(0, i + 1).join("/");
        const last = i === segments.length - 1;
        const inOrders = segments[i - 1] === "encomendas";
        const label = inOrders
          ? seg === "nova" ? "Nova encomenda" : seg === "cozinha" ? "Folha da cozinha" : "Encomenda"
          : (SEGMENT_LABELS[seg] ?? "Produto");
        return (
          <span key={href} className={last ? "flex min-w-0 items-center gap-1.5" : "hidden shrink-0 items-center gap-1.5 sm:flex"}>
            <span aria-hidden className={last ? "hidden sm:inline" : undefined}>/</span>
            {last ? (
              <span className="truncate font-medium text-cacau-900">{label}</span>
            ) : (
              <Link href={href} className="hover:text-cacau-900">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("tema", dark ? "escuro" : "claro");
    } catch {}
  };
  // Ícones alternados via CSS (classe .dark) para evitar divergência de hidratação
  return (
    <button type="button" className="btn-icon" aria-label="Alternar tema claro/escuro" onClick={toggle}>
      <SunIcon className="hidden size-4 dark:block" />
      <MoonIcon className="size-4 dark:hidden" />
    </button>
  );
}

export function AppShell({
  children,
  categories,
  logout,
  defaultCollapsed,
}: {
  children: React.ReactNode;
  categories: Category[];
  logout: () => Promise<void>;
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => setMobileOpen(false), [pathname, params]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="flex min-h-svh">
      <aside className={`hidden shrink-0 border-r border-creme-300 transition-[width] print:hidden lg:block ${collapsed ? "w-0 overflow-hidden border-r-0" : "w-64"}`}>
        <div className="sticky top-0 h-svh w-64">
          <SidebarContent categories={categories} logout={logout} />
        </div>
      </aside>

      {/* Menu no celular */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 print:hidden border-r border-creme-300 shadow-xl transition-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent categories={categories} logout={logout} onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 print:hidden items-center gap-2 border-b border-creme-300 bg-creme-100/95 px-4 backdrop-blur">
          <button type="button" className="btn-icon lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
            <MenuIcon className="size-4" />
          </button>
          <button type="button" className="btn-icon hidden lg:inline-flex" aria-label="Recolher menu" onClick={toggle}>
            <PanelLeftIcon className="size-4" />
          </button>
          <Breadcrumb />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
