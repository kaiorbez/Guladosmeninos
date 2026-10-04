import type { Prisma } from '@prisma/client';
import { bookPayment, refreshPaid } from '@/lib/orders';
import { AgentError, key, money } from './rules';

/** Compatibilidade do comprovante é a base autorizada de registro, sem alegar consulta ao banco. */
export async function recordReceiptPayment(tx: Prisma.TransactionClient, orderId:string, phone:string, mediaId:string, amount:number, paidAt=new Date()) {
  const eventKey=`receipt-payment:${phone}:${key(mediaId)}`;
  const previous=await tx.agentEvent.findUnique({where:{key:eventKey}});
  if(previous?.result)return previous.result;
  const locked=await tx.order.updateMany({where:{id:orderId,customerPhone:phone},data:{paid:{increment:0}}});
  if(!locked.count)throw new AgentError('Encomenda do comprovante não encontrada.',404);
  const afterLock=await tx.agentEvent.findUnique({where:{key:eventKey}});
  if(afterLock?.result)return afterLock.result;
  const order=await tx.order.findUniqueOrThrow({where:{id:orderId}});
  const missing=money(Number(order.total)-Number(order.paid));
  if(amount<=0 || money(amount)>missing)throw new AgentError('Pagamento já registrado ou maior que o saldo. Consulte a encomenda.',409);
  const payment=await tx.orderPayment.create({data:{orderId,amount:money(amount),method:'QR',paidAt}});
  // Fatura também quando o comprovante chega depois do despacho, sem repetir a entrega.
  await bookPayment(payment.id,undefined,tx);
  await refreshPaid(orderId,tx);
  const result={ok:true,registrado:true,pagamentoId:payment.id,valor:money(amount),base:'COMPROVANTE_COMPATIVEL',creditoBancarioConsultado:false};
  await tx.agentEvent.create({data:{key:eventKey,phone,kind:'RECEIPT_PAYMENT',payload:{orderId,mediaId,amount:money(amount)},result}});
  return result;
}
