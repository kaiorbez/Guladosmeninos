import type { Prisma } from '@prisma/client';
import { yangoUrl } from './rules';
/** Link historical compatible-receipt notices only using persisted payment references. No new sends. */
export async function backfillDeliveryLinks(tx: Prisma.TransactionClient) {
 const tickets=await tx.agentTicket.findMany({where:{kind:'COMPROVANTE'}});
 let linked=0,restored=0;
 for(const t of tickets) {
  if(t.orderId)continue;
  const prefix=`ticket:${t.phone}:COMPROVANTE:`;if(!t.sourceKey.startsWith(prefix))continue;
  const ids=new Set<string>();
  for(const mediaId of t.sourceKey.slice(prefix.length).split('|')) {
   const event=await tx.agentEvent.findUnique({where:{key:`receipt-payment:${t.phone}:${mediaId}`}});
   const orderId=(event?.payload as {orderId?:string}|undefined)?.orderId;if(orderId)ids.add(orderId);
  }
  if(ids.size!==1)continue;
  const orderId=[...ids][0],order=await tx.order.findUnique({where:{id:orderId}});if(!order||order.customerPhone!==t.phone)continue;
  await tx.agentTicket.update({where:{id:t.id},data:{orderId}});t.orderId=orderId;linked++;
 }
 const deliveries=await tx.agentDelivery.findMany({where:{key:{startsWith:'yango:'},status:'SENT'},orderBy:{createdAt:'asc'}});
 for(const d of deliveries) {
  const ticket=tickets.find(t=>t.id===d.ticketId);if(!ticket?.orderId||ticket.phone!==d.phone)continue;
  const order=await tx.order.findUnique({where:{id:ticket.orderId}});if(!order||order.deliveryLinkSentAt)continue;
  const url=String((d.body as {message?:string}).message||'').match(/https:\/\/\S+/)?.[0];if(!url)continue;
  let link:string;try{link=yangoUrl(url);}catch{continue;}
  await tx.order.update({where:{id:order.id},data:{deliveryLink:link,deliveryLinkSentAt:d.createdAt,dispatchedAt:d.createdAt}});restored++;
 }
 return {linked,restored};
}
