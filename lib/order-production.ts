import { prisma } from "./db";
import { recordOrderActivity } from "./order-history";

/** Marca o preparo sem receber pagamento, gerar venda ou concluir a entrega. */
export async function setOrderProduced(orderId: string, produced: boolean, userId?: string) {
  return prisma.$transaction(async tx => {
  const result = await tx.order.updateMany({
    where: { id: orderId, status: "PENDENTE", producedAt: produced ? null : { not: null } },
    data: { producedAt: produced ? new Date() : null, agentVersion: { increment: 1 } },
  });
  if (result.count) await recordOrderActivity(tx, orderId, produced ? "Marcado como produzido" : "Produção desmarcada", userId);
  return result;
  });
}
