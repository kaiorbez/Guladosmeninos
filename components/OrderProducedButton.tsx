import { CheckIcon, ChefHatIcon } from "lucide-react";
import { ConfirmButton } from "./ConfirmButton";
import { dateTime } from "@/lib/format";
import { setOrderProducedAction } from "@/app/painel/encomendas/actions";

export function OrderProducedButton({ orderId, producedAt }: { orderId: string; producedAt: Date | null }) {
  return (
    <form action={setOrderProducedAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="produced" value={producedAt ? "0" : "1"} />
      {producedAt ? (
        <ConfirmButton message="Desmarcar este pedido como produzido?" className="btn-ghost border-emerald-500/40 bg-emerald-500/10 py-1.5 text-emerald-700 dark:text-emerald-400" title={`Produzido em ${dateTime(producedAt)}. Clique para desmarcar.`}>
          <CheckIcon className="size-4" /> Produzido
        </ConfirmButton>
      ) : (
        <button className="btn-ghost py-1.5" title="Marcar que o pedido já está pronto, aguardando entrega">
          <ChefHatIcon className="size-4" /> Marcar produzido
        </button>
      )}
    </form>
  );
}
