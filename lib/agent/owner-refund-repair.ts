import type { Prisma } from '@prisma/client';
import { recordOrderActivity } from '../order-history';

/** Book a reviewed outgoing receipt as an expense; never issue a bank payment. */
export async function reconcileBiozentRefund(tx: Prisma.TransactionClient) {
 const key='owner-refund:2026-10-17:1000645286',phone='59175076087';
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
 const old=await tx.agentEvent.findUnique({where:{key}});if(old)return old.result;
 const order=await tx.order.findUnique({where:{id:'cmvcqjbrf000kpk3cj5uu5y8c'}});
 if(!order)return {skipped:'NOT_THIS_DATABASE'};
 const source=await tx.agentEvent.findUnique({where:{key:`in:${phone}:3EB0AC44AA118095C6FF93`}});
 const payload=source?.payload as Record<string,unknown>|undefined;
 if(!source||source.phone!==phone||payload?.fromMe!==true||payload?.media!=='imagem')throw Error('Reviewed outgoing refund receipt source missing');
 if(order.number!==164||order.customerPhone!==phone||Number(order.total)!==100||Number(order.paid)!==100||order.status!=='ENTREGUE')throw Error('Refund order changed since review');
 const date=new Date('2026-10-17T00:00:00Z');
 const expenses=await tx.expense.findMany({where:{date,amount:20}});
 const matching=expenses.filter(e=>/1000645286|(?:reembols|estorn|devolu).*(?:164|biozent|nathalia)|(?:164|biozent|nathalia).*(?:reembols|estorn|devolu)/i.test(e.description||''));
 if(matching.length>1)throw Error('Multiple refund expense candidates; no duplicate booked');
 if(!matching.length && expenses.some(e=>/reembols|estorn|devolu/i.test(e.description||'')))return {skipped:'AMBIGUOUS_EXISTING_REFUND_EXPENSE'};
 const expense=matching[0]||await tx.expense.create({data:{id:'owner-refund-1000645286',date,category:'OUTROS',method:'QR',amount:20,description:'Devolução pedido #164 Biozent M40: 1 empadão faltante. Comprovante Ganadero 17/10/2026 17:06, operação 1000645286, destino Nathalia Bause Vaca.'}});
 const notes=(order.notes||'').split('\n').filter(line=>!line.startsWith('CONCILIAÇÃO PENDENTE: cliente solicitou reembolso de 20 Bs')).join('\n');
 await tx.order.update({where:{id:order.id},data:{notes:notes+'\nDEVOLUÇÃO REGISTRADA: 20 Bs por 1 empadão faltante. Comprovante enviado pela equipe às 17h08, operação 1000645286 de 17/10 às 17h06. Saída vinculada no financeiro (Outros); recebimento original de 100 Bs preservado. Líquido após devolução: 80 Bs. Sem nova transferência bancária.'}});
 await recordOrderActivity(tx,order.id,'Comprovante original de devolução de 20 Bs conferido; saída conciliada no financeiro. Operação 1000645286. Sem novo pagamento bancário.');
 const result={orderNumber:164,expenseId:expense.id,refund:20,gross:100,net:80};
 await tx.agentEvent.create({data:{key,phone,kind:'OWNER_REFUND_RECONCILIATION',payload:{sourceMessageId:'3EB0AC44AA118095C6FF93',sourceExecution:'93508',visualReview:true,operation:'1000645286',bankAccountQueried:false,existingExpense:!!matching[0]},result}});
 return result;
}
