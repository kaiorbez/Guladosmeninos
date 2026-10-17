import type { Prisma } from '@prisma/client';
import { recordReceiptPayment } from './payments';
import { recordOrderActivity } from '../order-history';

// Explicit owner-authorized correction of two original receipts reviewed on 17/10.
// This is not an OCR tolerance rule or an automatic import of human conversations.
export async function repairOwnerReceiptsOctober17(tx: Prisma.TransactionClient) {
  const cases = [
    { phone:'59178049800', mediaId:'4ABBCA974E293FFA243E', amount:230, orderId:'cmvcotled0004my3cdrru27jt', paidAt:'2026-10-17T17:46:00Z' },
    { phone:'556596159186', mediaId:'AC170CD6A907A30A4F2AEF31A8C810DF', amount:30, orderId:null, paidAt:'2026-10-17T14:48:00Z' },
  ];
  const digits = (v:string|null) => String(v||'').replace(/\D/g,'');
  const results = [];
  for (const c of cases) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.phone}))`;
    const auditKey=`owner-repair:2026-10-17:${c.mediaId}`;
    const old=await tx.agentEvent.findUnique({where:{key:auditKey}});
    if(old) { results.push(old.result); continue; }
    const source=await tx.agentEvent.findUnique({where:{key:`in:${c.phone}:${c.mediaId}`}});
    const payload=source?.payload as Record<string,unknown>|undefined;
    if(!source) { results.push({phone:c.phone,skipped:'SOURCE_NOT_IN_THIS_DATABASE'}); continue; }
    if(source.phone!==c.phone || payload?.media!=='imagem' || payload?.fromMe!==false) throw Error('Receipt correction source mismatch');
    const orders=await tx.order.findMany({where:{customerPhone:{not:null}}});
    const candidates=orders.filter(o=>digits(o.customerPhone)===c.phone && o.status!=='CANCELADA' &&
      o.deliveryDate.toISOString().slice(0,10)==='2026-10-17' && Number(o.total)===c.amount);
    if(candidates.length>1) throw Error('Multiple matching orders: manual review required');
    let order=c.orderId?orders.find(o=>o.id===c.orderId):candidates[0];
    if(c.orderId && (!order || candidates[0]?.id!==c.orderId)) throw Error('Receipt correction order mismatch');
    if(!order) {
      const sales=await tx.sale.findMany({where:{status:'CONFIRMADA',createdAt:{gte:new Date('2026-10-17T04:00:00Z'),lt:new Date('2026-10-18T04:00:00Z')}}});
      if(sales.some(s=>digits(s.customerPhone)===c.phone && Number(s.total)===c.amount)) throw Error('Existing sale: link it before creating an order/payment');
      order=await tx.order.create({data:{
        customerName:'Ana Clara Ferreira',customerPhone:c.phone,channel:'WHATSAPP',
        agentRef:auditKey,total:30,paid:0,payFull:true,status:'PENDENTE',
        deliveryDate:new Date('2026-10-17T00:00:00Z'),deliveryTime:'AGORA',deliveryMode:'ENTREGA',
        deliveryAddress:'https://maps.google.com/?q=-17.766806706774116,-63.19870501756668',
        product:'1 × Fatia Doce de Leite com Ninho e geleia de Morango — 30 Bs',
        agentItems:[{descricao:'Fatia Doce de Leite com Ninho e geleia de Morango',quantidade:1,precoUnitario:30}],
        notes:'Correção autorizada pelo proprietário: venda concluída no atendimento humano. Comprovante original de 30 Bs de 17/10/2026 às 10:48, operação 999598934, conferido visualmente. Nova localização informada às 14:00 substitui C. Tajibo. Yango separado; não incluído nos 30 Bs. Previsão de envio após 13:00; horário exato não confirmado. Entrega não confirmada por esta correção.',
      }});
    }
    const before={id:order.id,paid:Number(order.paid),status:order.status};
    if(Number(order.paid)===0) await recordReceiptPayment(tx,order.id,c.phone,c.mediaId,c.amount,new Date(c.paidAt));
    else if(Number(order.paid)!==c.amount) throw Error('Existing partial payment: manual review required');
    if(c.orderId) await tx.agentTicket.updateMany({
      where:{phone:c.phone,sourceKey:`ticket:${c.phone}:COMPROVANTE:${c.mediaId}`},
      data:{status:'RESOLVIDA',resolvedBy:'Correção autorizada pelo proprietário',resolvedAt:new Date(),
        answer:'Comprovante original conferido visualmente: beneficiário LAZZARINI FRANCA MATHEUS, Banco Ganadero, 230 Bs, 17/10/2026 13:46, transação 52813914208. Corrigida a leitura MATEUS; pagamento vinculado ao pedido #160. Não representa consulta ao extrato.'},
    });
    await recordOrderActivity(tx,order.id,`Correção autorizada: comprovante original de ${c.amount} Bs vinculado; sem alteração da entrega e sem novo envio ao cliente.`);
    const result={orderId:order.id,number:order.number,phone:c.phone,amount:c.amount};
    await tx.agentEvent.create({data:{key:auditKey,phone:c.phone,kind:'OWNER_RECEIPT_REPAIR',
      payload:{before,mediaId:c.mediaId,visualReview:true,ownerAuthorized:true,bankAccountQueried:false},result}});
    results.push(result);
  }
  return results;
}
