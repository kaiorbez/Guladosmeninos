import type { Prisma } from '@prisma/client';
import { recordOrderActivity } from '../order-history';

/** Repair only the two reviewed fichas; preserve payment ID, date and financial sale. */
export async function repairCarmichelineDuplicate(tx: Prisma.TransactionClient) {
  const auditKey='owner-repair:2026-10-17:carmicheline-156-157';
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'558896002423'}))`;
  const done=await tx.agentEvent.findUnique({where:{key:auditKey}});
  if(done)return done.result;
  const target=await tx.order.findUnique({where:{id:'cmvchggki0004p83dsbq0sdf1'},include:{payments:true}});
  const duplicate=await tx.order.findUnique({where:{id:'cmvcjug2d0005p83dcmzdue6i'},include:{payments:true}});
  if(!target && !duplicate)return {skipped:'NOT_THIS_DATABASE'};
  const digits=(s:string|null)=>String(s||'').replace(/\D/g,'');
  if(!target||!duplicate||target.number!==156||duplicate.number!==157||
    [target,duplicate].some(o=>digits(o.customerPhone)!=='558896002423'||o.status!=='PENDENTE'||Number(o.total)!==190||o.saleId)||
    target.deliveryDate.toISOString().slice(0,10)!=='2026-10-20'||target.deliveryTime!=='14:00'||
    duplicate.deliveryDate.toISOString().slice(0,10)!=='2026-10-18'||duplicate.deliveryTime!=='14:00'||
    Number(target.paid)!==0||target.payments.length!==0||Number(duplicate.paid)!==95||duplicate.payments.length!==1||Number(duplicate.payments[0].amount)!==95)
    throw Error('Carmicheline changed since review; no repair applied');
  const before=JSON.parse(JSON.stringify({target,duplicate}));
  const payment=duplicate.payments[0];
  if(!payment.saleId)throw Error('Reviewed deposit must already have a financial sale');
  const sale=await tx.sale.findUnique({where:{id:payment.saleId}});
  if(!sale||sale.status!=='CONFIRMADA'||Number(sale.total)!==95||digits(sale.customerPhone)!=='558896002423')throw Error('Reviewed deposit sale mismatch');
  await tx.orderPayment.update({where:{id:payment.id},data:{orderId:target.id}});
  await tx.sale.update({where:{id:sale.id},data:{customerPhone:'558896002423'}});
  await tx.order.update({where:{id:target.id},data:{paid:95,agentVersion:{increment:1},notes:'Entrega confirmada pela cliente em 17/10: terça, 20/10 às 14h. Sinal de 95 Bs já registrado pela equipe na ficha duplicada #157 e vinculado a esta ficha por correção autorizada. Saldo: 95 Bs. Endereço e composição preservados.'}});
  await tx.order.update({where:{id:duplicate.id},data:{customerPhone:'558896002423',paid:0,status:'CANCELADA',agentVersion:{increment:1},notes:'Ficha duplicada encerrada por correção autorizada. Pedido válido: #156, entrega 20/10 às 14h. O pagamento original de 95 Bs foi transferido para #156 sem estorno nem novo faturamento.'}});
  await recordOrderActivity(tx,target.id,'Correção autorizada: sinal original de 95 Bs vinculado da ficha #157; data 20/10 às 14h conforme conversa. Sem novo recebimento.');
  await recordOrderActivity(tx,duplicate.id,'Duplicata encerrada; pagamento original preservado e vinculado ao pedido #156.');
  const result={orderNumber:156,duplicateNumber:157,paid:95,balance:95,paymentId:payment.id,saleId:sale.id};
  await tx.agentEvent.create({data:{key:auditKey,phone:'558896002423',kind:'OWNER_ORDER_REPAIR',payload:JSON.parse(JSON.stringify({before,sourceExecutions:['90367','90375'],authorized:true})) as Prisma.InputJsonValue,result}});
  return result;
}
