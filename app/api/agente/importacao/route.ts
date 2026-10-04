import { prisma } from '@/lib/db';
import { agentAuthorized, unauthorized } from '@/lib/agent-auth';
import { AgentError, dateOnly, dayLaPaz, key, money, phone, text } from '@/lib/agent/rules';
import { bookPayment, refreshPaid } from '@/lib/orders';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
// Importação administrativa do histórico revisado, sem mensagens ou alertas.
// Não é uma ferramenta do agente de atendimento e não altera preços do catálogo.
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return unauthorized();
  try {
    const raw = await req.text();
    if (raw.length > 20000) throw new AgentError('Importação muito grande.');
    const b = JSON.parse(raw);
    if (!b || b.revisado !== true || !Array.isArray(b.comprovantes) || !b.comprovantes.length || b.comprovantes.length > 10) throw new AgentError('Exige revisão e referências dos comprovantes.');
    const p = phone(b.telefone), ref = key(b.ref), name = text(b.cliente,120);
    const day = dateOnly(b.diaRecebimento), delivery = dateOnly(b.dataEntrega);
    if (!name || !ref.startsWith('auditoria-wpp:') || day > dayLaPaz() || Date.parse(day) < Date.now()-32*86400000) throw new AgentError('Importação fora da janela autorizada.');
    const lines = b.itens;
    if (!Array.isArray(lines) || !lines.length || lines.length > 30) throw new AgentError('Itens obrigatórios.');
    const normalized = lines.map((i: Record<string,unknown>) => {
      const description=text(i.descricao,300), quantity=i.quantidade;
      if (!description || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new AgentError('Item inválido.');
      return {descricao:description,quantidade:quantity,precoUnitario:money(i.precoUnitario)};
    });
    const total=money(normalized.reduce((s:number,i:{quantidade:number;precoUnitario:number})=>s+i.quantidade*i.precoUnitario,0));
    const payments=b.comprovantes.map((r:Record<string,unknown>)=>({messageId:key(r.messageId),valor:money(r.valor),hora:text(r.hora,5)}));
    if (payments.some((r:{valor:number;hora:string})=>r.valor<=0 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.hora)) || new Set(payments.map((r:{messageId:string})=>r.messageId)).size!==payments.length) throw new AgentError('Comprovantes inválidos ou repetidos.');
    const paid=money(payments.reduce((s:number,r:{valor:number})=>s+r.valor,0));
    if(total<=0 || paid>total) throw new AgentError('Pagamento excede o pedido.');
    if(!['ENTREGA','RETIRADA'].includes(b.modalidade)) throw new AgentError('Modalidade inválida.');
    const delivered=b.entregue===true;
    if(delivered && paid!==total) throw new AgentError('Pedido com saldo não será marcado entregue.');
    const result=await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ref}))`;
      const old=await tx.order.findUnique({where:{agentRef:ref}});
      if(old)return {ok:true,duplicada:true,pedido:{id:old.id,numero:old.number,total:Number(old.total),pago:Number(old.paid)}};
      const existing=await tx.order.findFirst({where:{customerPhone:{endsWith:p.slice(-8)},deliveryDate:new Date(delivery+'T00:00:00Z'),total}});
      if(existing)throw new AgentError('Já existe encomenda com cliente, data e total iguais; revisar antes de importar.',409);
      const order=await tx.order.create({data:{agentRef:ref,customerName:name,customerPhone:p,channel:'WHATSAPP',deliveryDate:new Date(delivery+'T00:00:00Z'),deliveryTime:null,deliveryMode:b.modalidade,deliveryAddress:text(b.endereco,1000)||null,product:normalized.map((i:{descricao:string;quantidade:number;precoUnitario:number})=>`${i.quantidade} × ${i.descricao} — ${i.precoUnitario} Bs`).join('\n'),agentItems:normalized as Prisma.InputJsonValue,total,paid:0,notes:'IMPORTAÇÃO REVISADA: '+text(b.observacoes,1800),createdAt:new Date(day+'T12:00:00-04:00')}});
      for(const r of payments){
        const paidAt=new Date(`${day}T${r.hora}:00-04:00`);
        const receipt=await tx.orderPayment.create({data:{orderId:order.id,amount:r.valor,method:'QR',paidAt}});
        await bookPayment(receipt.id,undefined,tx);
        const booked=await tx.orderPayment.findUniqueOrThrow({where:{id:receipt.id}});
        if(booked.saleId)await tx.sale.update({where:{id:booked.saleId},data:{createdAt:paidAt,notes:`Importação WhatsApp revisada. Comprovante ${r.messageId}. ${text(b.observacoes,700)}`}});
      }
      await refreshPaid(order.id,tx);
      if(delivered)await tx.order.update({where:{id:order.id},data:{status:'ENTREGUE'}});
      return {ok:true,duplicada:false,pedido:{id:order.id,numero:order.number,total,pago:paid,saldo:money(total-paid)}};
    });
    return Response.json(result);
  } catch(e){
    if(e instanceof AgentError)return Response.json({ok:false,error:e.message},{status:e.status});
    if(e instanceof SyntaxError)return Response.json({ok:false,error:'JSON inválido.'},{status:400});
    console.error('[agente/importacao]',e instanceof Error?e.name:'erro');
    return Response.json({ok:false,error:'Importação cancelada; nenhuma confirmação de sucesso.'},{status:500});
  }
}
