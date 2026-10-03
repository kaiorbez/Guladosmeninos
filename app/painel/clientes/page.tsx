import Link from "next/link";
import { MessageCircleIcon, Trash2Icon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Kpi } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { bs, shortDate } from "@/lib/format";
import { hideClientAction, restoreClientAction } from "./actions";

type Client = {
  key: string;
  name: string;
  phone: string | null;
  sales: number;
  spent: number;
  orders: number;
  pendingOrders: number;
  last: Date;
};

/** Mesmo cliente com ou sem o 591 (código da Bolívia) na frente. */
const normalizePhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("591") ? d.slice(3) : d;
};
const waUrl = (p: string) => `https://wa.me/${p.length === 8 ? `591${p}` : p}`;

const SORTS = { gasto: "Mais gastou", recente: "Mais recente", compras: "Mais compras" } as const;
type Sort = keyof typeof SORTS;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; ordem?: string; ocultos?: string }> }) {
  const sp = await searchParams;
  const showHidden = sp.ocultos === "1";
  const q = sp.q?.trim().toLowerCase();
  const sort: Sort = sp.ordem && sp.ordem in SORTS ? (sp.ordem as Sort) : "gasto";

  const [sales, orders, hiddenRows] = await Promise.all([
    prisma.sale.findMany({
      where: { status: "CONFIRMADA", OR: [{ customerName: { not: null } }, { customerPhone: { not: null } }] },
      select: { customerName: true, customerPhone: true, total: true, createdAt: true, externalRef: true },
    }),
    prisma.order.findMany({
      where: { status: { not: "CANCELADA" } },
      select: { customerName: true, customerPhone: true, status: true, createdAt: true },
    }),
    prisma.hiddenClient.findMany({ select: { key: true } }),
  ]);
  const hidden = new Set(hiddenRows.map((h) => h.key));

  // Junta vendas e encomendas pelo celular; sem celular, pelo nome.
  const clients = new Map<string, Client>();
  const touch = (name: string | null, phone: string | null, at: Date) => {
    const p = phone ? normalizePhone(phone) : "";
    const n = name?.trim() ?? "";
    if (!p && !n) return null;
    const key = p.length >= 7 ? `tel:${p}` : `nome:${n.toLowerCase()}`;
    const c = clients.get(key) ?? { key, name: n || p, phone: p.length >= 7 ? p : null, sales: 0, spent: 0, orders: 0, pendingOrders: 0, last: at };
    if (at >= c.last) {
      c.last = at;
      if (n) c.name = n; // nome mais recente
    }
    clients.set(key, c);
    return c;
  };
  for (const s of sales) {
    const c = touch(s.customerName, s.customerPhone, s.createdAt);
    if (c) {
      // Vendas geradas por encomendas (pagamentos/entrega) somam no gasto, mas a compra já conta como encomenda.
      if (!s.externalRef?.startsWith("encomenda")) c.sales += 1;
      c.spent += Number(s.total);
    }
  }
  for (const o of orders) {
    const c = touch(o.customerName, o.customerPhone, o.createdAt);
    if (c) {
      c.orders += 1;
      if (o.status === "PENDENTE") c.pendingOrders += 1;
    }
  }

  let list = [...clients.values()].filter((c) => hidden.has(c.key) === showHidden);
  if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q.replace(/\D/g, "") || "§"));
  list.sort((a, b) =>
    sort === "recente" ? b.last.getTime() - a.last.getTime() : sort === "compras" ? b.sales + b.orders - (a.sales + a.orders) : b.spent - a.spent,
  );

  const all = [...clients.values()].filter((c) => !hidden.has(c.key));
  const hiddenCount = [...clients.values()].filter((c) => hidden.has(c.key)).length;
  const returning = all.filter((c) => c.sales + c.orders > 1).length;
  const totalSpent = all.reduce((s, c) => s + c.spent, 0);

  return (
    <>
      <PageHeader title="Clientes" subtitle="Quem já comprou, juntando vendas e encomendas pelo celular" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Clientes" value={String(all.length)} hint="com nome ou celular registrado" />
        <Kpi label="Voltaram a comprar" value={String(returning)} hint="mais de uma compra ou encomenda" />
        <Kpi label="Gasto médio" value={bs(all.length ? totalSpent / all.length : 0)} hint="por cliente, em vendas" />
      </div>

      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <Link key={s} href={`/painel/clientes?ordem=${s}${q ? `&q=${encodeURIComponent(sp.q ?? "")}` : ""}`} className={`btn py-1.5 ${s === sort ? "btn-on" : "btn-ghost"}`}>
              {SORTS[s]}
            </Link>
          ))}
        </div>
        {(hiddenCount > 0 || showHidden) && (
          <Link href={showHidden ? "/painel/clientes" : "/painel/clientes?ocultos=1"} className="text-sm text-cacau-500 hover:text-cacau-900 hover:underline">
            {showHidden ? "← Voltar para a lista" : `Excluídos (${hiddenCount})`}
          </Link>
        )}
        <form action="/painel/clientes" className="flex items-center gap-2">
          <input type="hidden" name="ordem" value={sort} />
          <input name="q" defaultValue={sp.q} placeholder="Buscar nome ou celular..." className="input w-56" />
          <button className="btn-ghost">Buscar</button>
        </form>
      </div>

      <div className="card overflow-x-auto p-0">
        {list.length === 0 ? (
          <p className="p-5 text-sm text-cacau-500">
            {showHidden ? "Nenhum cliente excluído." : q ? "Nenhum cliente encontrado." : "Ainda não há clientes. Eles aparecem quando uma venda ou encomenda tem nome ou celular."}
          </p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th className="pl-5">Cliente</th>
                <th>Celular</th>
                <th className="text-right">Compras</th>
                <th className="text-right">Gasto total</th>
                <th className="text-right">Encomendas</th>
                <th className="text-right">Última vez</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.key}>
                  <td className="pl-5 font-medium">{c.name}</td>
                  <td className="whitespace-nowrap">
                    {c.phone ? (
                      <a href={waUrl(c.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        <MessageCircleIcon className="size-3.5 text-cacau-500" />
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-cacau-400">—</span>
                    )}
                  </td>
                  <td className="text-right">{c.sales}</td>
                  <td className="whitespace-nowrap text-right font-medium">{bs(c.spent)}</td>
                  <td className="whitespace-nowrap text-right">
                    {c.orders}
                    {c.pendingOrders > 0 && <span className="ml-1 text-xs text-dourado-600">({c.pendingOrders} pendente)</span>}
                  </td>
                  <td className="whitespace-nowrap text-right text-cacau-500">{shortDate(c.last)}</td>
                  <td className="pr-5 text-right">
                    {showHidden ? (
                      <form action={restoreClientAction}>
                        <input type="hidden" name="key" value={c.key} />
                        <button className="text-xs text-cacau-500 hover:text-cacau-900 hover:underline">restaurar</button>
                      </form>
                    ) : (
                      <form action={hideClientAction}>
                        <input type="hidden" name="key" value={c.key} />
                        <input type="hidden" name="name" value={c.name} />
                        <ConfirmButton
                          message={`Excluir ${c.name} da lista de clientes? As vendas e encomendas dele continuam no painel.`}
                          className="btn-icon"
                          title="Excluir cliente"
                        >
                          <Trash2Icon className="size-3.5" />
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
