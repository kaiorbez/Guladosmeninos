import { prisma } from '@/lib/db';
import { lockConversation } from './transport';

/** Only the documented Bolivian 8-digit legacy format is linked. Never guess another country. */
export async function linkLegacyOrders(p: string) {
  if (!/^591[67]\d{7}$/.test(p)) return;
  const legacy = p.slice(3);
  await prisma.$transaction(async tx => {
    await lockConversation(tx, p);
    const old = await tx.order.findMany({where:{customerPhone:legacy}});
    if (!old.length) return;
    // Relink the existing rows, preserving money, dates, status and primary keys.
    await tx.order.updateMany({where:{id:{in:old.map(o=>o.id)},customerPhone:legacy},data:{customerPhone:p}});
  });
}
