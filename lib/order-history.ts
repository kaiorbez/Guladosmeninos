import type { Prisma } from "@prisma/client";

export async function recordOrderActivity(tx: Prisma.TransactionClient, orderId: string, action: string, userId?: string) {
  const user = userId ? await tx.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  await tx.orderActivity.create({ data: { orderId, action, actorId: userId ?? null, actorName: user?.name || "Sistema" } });
}
