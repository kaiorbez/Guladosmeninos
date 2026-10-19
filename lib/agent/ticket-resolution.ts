import type { Prisma } from '@prisma/client';
import { AgentError } from './rules';

export async function resolveTicketInTransaction(tx: Prisma.TransactionClient, id: string, answer: string, who: string) {
 const t=await tx.agentTicket.findUnique({where:{id}});
 if(!t)throw new AgentError('Aviso não encontrado.',404);
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${t.phone}))`;
 const changed=await tx.agentTicket.updateMany({where:{id,status:{in:['ABERTA','ASSUMIDA']}},data:{status:'RESOLVIDA',answer:answer||null,resolvedBy:who,resolvedAt:new Date()}});
 if(!changed.count)return {ok:true,telefone:t.phone,retomado:false,motivo:'AVISO_JA_RESOLVIDO'};
 await tx.agentConversation.updateMany({where:{phone:t.phone},data:{pausedUntil:null,generation:{increment:1}}});
 return {ok:true,telefone:t.phone,retomado:true};
}

export async function syncPanelResume(ticketId: string, phone: string, generation: number) {
 const token=process.env.AGENT_API_TOKEN;
 if(!token)throw new Error('Liberação do atendimento não configurada.');
 const url=process.env.GULA_RESUME_URL||'https://n8n-amri.srv2034106.hstgr.cloud/webhook/gula-resolver-painel';
 const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({ticketId,phone,generation}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('A pendência foi resolvida, mas a liberação do fluxo falhou. Tente novamente.');
 const raw=await r.json();const result=Array.isArray(raw)?raw[0]:raw;
 if(result?.ok!==true||result?.retomado!==true)throw new Error('A liberação não foi confirmada. Pode haver um novo atendimento humano; confira antes de tentar novamente.');
}
