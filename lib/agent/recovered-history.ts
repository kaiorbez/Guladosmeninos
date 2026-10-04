import { prisma } from '@/lib/db';
import { AgentError, key, phone, text } from './rules';
import { lockConversation } from './transport';

type HistoricalMessage={messageId:unknown;texto:unknown;momento:unknown;fromMe:unknown};
/** Administrative backfill from actual ReceivedCallback records; never triggers orders or sends. */
export async function recoverHistory(raw: Record<string,unknown>) {
  const p=phone(raw.telefone);
  if(raw.revisado!==true || raw.fonte!=='N8N_CALLBACK' || !Array.isArray(raw.mensagens) || !raw.mensagens.length || raw.mensagens.length>100) throw new AgentError('Histórico exige fonte revisada e lote de até 100 mensagens.');
  const messages=(raw.mensagens as HistoricalMessage[]).map(m=>{
    const id=key(m.messageId), content=text(m.texto,12000), moment=Number(m.momento);
    if(!content || !Number.isFinite(moment)||moment<=0 || moment>Date.now()+300000 || typeof m.fromMe!=='boolean') throw new AgentError('Mensagem histórica inválida.');
    return {id,content,moment,fromMe:m.fromMe};
  });
  return prisma.$transaction(async tx=>{
    await lockConversation(tx,p);
    let inserted=0;
    for(const m of messages){
      const eventKey=`history-msg:${p}:${m.id}`;
      if(await tx.agentEvent.findUnique({where:{key:eventKey}}))continue;
      // Live data always wins. A replay must never masquerade as a fresh payment/message.
      if(await tx.agentEvent.findUnique({where:{key:`in:${p}:${m.id}`}}))continue;
      await tx.agentEvent.create({data:{key:eventKey,phone:p,kind:'HISTORY',payload:{text:m.content,fromMe:m.fromMe,messageId:m.id,fonte:'N8N_CALLBACK'},createdAt:new Date(m.moment)}});
      inserted++;
    }
    await tx.agentEvent.upsert({where:{key:`history-n8n:${p}`},create:{key:`history-n8n:${p}`,phone:p,kind:'HISTORY_RECOVERED',payload:{fonte:'N8N_CALLBACK',parcial:true}},update:{}});
    return {ok:true,telefone:p,importadas:inserted,recebidas:messages.length,historicoParcial:true};
  });
}
