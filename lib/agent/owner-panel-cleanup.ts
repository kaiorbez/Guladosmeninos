import type { Prisma } from '@prisma/client';
import { resolveTicketInTransaction } from './ticket-resolution';
import { recordOrderActivity } from '../order-history';
export const CLEANUP_KEY='owner-cleanup:2026-10-19:panel-pendencias-test-213-215';
export async function cleanupPanelOctober19(tx: Prisma.TransactionClient) {
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CLEANUP_KEY}))`;
 const old=await tx.agentEvent.findUnique({where:{key:CLEANUP_KEY}});if(old)return old.result;
 const orders=await tx.order.findMany({where:{number:{in:[213,214,215]}},include:{payments:true}});
 if(orders.length && (orders.length!==3 || orders.some(o=>o.customerPhone!=='59175678921'||o.customerName!=='[TESTE] Claude'||Number(o.paid)!==0||o.payments.length||o.saleId||!['PENDENTE','CANCELADA'].includes(o.status))))throw Error('Pedidos de teste divergem da revisão; nenhuma limpeza aplicada.');
 const tickets=await tx.agentTicket.findMany({where:{status:{in:['ABERTA','ASSUMIDA']},createdAt:{lte:new Date('2026-10-19T14:15:19Z')}},orderBy:[{phone:'asc'},{id:'asc'}]});
 const byPhone=new Map<string,string>();
 for(const t of tickets){await resolveTicketInTransaction(tx,t.id,t.answer||'','Proprietário: encerramento autorizado em 19/10/2026');byPhone.set(t.phone,t.id);}
 for(const order of orders){if(order.status==='CANCELADA')continue;await tx.order.update({where:{id:order.id},data:{status:'CANCELADA',agentVersion:{increment:1}}});await recordOrderActivity(tx,order.id,'Pedido [TESTE] Claude cancelado a pedido do proprietário em 19/10/2026. Sem pagamento ou venda; histórico preservado.');}
 const resumptions=[];
 for(const [phone,ticketId] of byPhone){const c=await tx.agentConversation.findUnique({where:{phone}});if(c)resumptions.push({phone,ticketId,generation:c.generation});}
 const result={resolved:tickets.length,ticketIds:tickets.map(t=>t.id),orders:orders.map(o=>o.number),resumptions};
 await tx.agentEvent.create({data:{key:CLEANUP_KEY,phone:'59175678921',kind:'OWNER_PANEL_CLEANUP',payload:JSON.parse(JSON.stringify({before:{orders,tickets},cutoff:'2026-10-19T14:15:19Z',requestedByOwner:true})),result}});
 return result;
}
