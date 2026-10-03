import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { lateLabel, lateOrders } from "@/lib/orders";

/** Aviso no topo do painel: encomendas pendentes 30 min depois do horário combinado. */
export async function LateOrdersBanner() {
  const late = await lateOrders();
  if (late.length === 0) return null;
  return (
    <Link
      href="/painel/encomendas"
      className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-coral-500/50 bg-coral-500/10 px-4 py-3 text-sm text-coral-600 hover:bg-coral-500/15"
      role="alert"
    >
      <AlertTriangleIcon className="size-4 shrink-0" />
      <b>{late.length === 1 ? "1 encomenda atrasada" : `${late.length} encomendas atrasadas`}</b>
      <span className="text-cacau-700">
        {late
          .slice(0, 4)
          .map((o) => `#${o.number} ${o.customerName}${o.deliveryTime ? ` (${o.deliveryTime})` : ""} há ${lateLabel(o.late)}`)
          .join(" · ")}
        {late.length > 4 && ` · +${late.length - 4}`}
      </span>
      <span className="ml-auto font-medium underline-offset-2 hover:underline">Ver encomendas →</span>
    </Link>
  );
}
