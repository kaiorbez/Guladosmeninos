import { prisma } from "./db";

/** Marca o preparo sem receber pagamento, gerar venda ou concluir a entrega. */
export async function setOrderProduced(orderId: string, produced: boolean) {
  return prisma.order.updateMany({
    where: { id: orderId, status: "PENDENTE", producedAt: produced ? null : { not: null } },
    data: { producedAt: produced ? new Date() : null, agentVersion: { increment: 1 } },
  });
}
