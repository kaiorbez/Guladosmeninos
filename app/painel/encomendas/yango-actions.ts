'use server';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendYangoLink } from '@/lib/agent/service';
import { syncPanelResume } from '@/lib/agent/ticket-resolution';
import { AgentError } from '@/lib/agent/rules';
export type YangoState={ok:boolean;message:string;sentAt?:string};
export async function sendYango(_:YangoState|null,form:FormData):Promise<YangoState> {
 await requireSession();
 let sentAt:string|undefined;
 try {
  const raw=String(form.get('fee')||'').trim();const fee=raw===''?null:Number(raw.replace(',','.'));
  const result=await sendYangoLink({orderId:String(form.get('orderId')||'')||undefined,ticketId:String(form.get('ticketId')||'')||undefined,link:form.get('link'),fee,source:'painel'});
  if(!result.enviado)return {ok:false,message:'O envio não foi confirmado. Confira o WhatsApp antes de tentar novamente.'};
  sentAt=result.sentAt;
  let warning='';
  if(result.resumeTicketId) {
   const c=await prisma.agentConversation.findUnique({where:{phone:result.telefone}});
   try{await syncPanelResume(result.resumeTicketId,result.telefone,c?.generation||0);}catch{warning=' A liberação da IA não foi confirmada; confira em Pendências da IA.';}
  }
  if('groupNoticeSent' in result&&result.groupNoticeSent===false)warning+=' O aviso ao grupo não foi confirmado.';
  revalidatePath('/painel/encomendas');if(result.orderId)revalidatePath('/painel/encomendas/'+result.orderId);revalidatePath('/painel/pendencias');
  return {ok:!warning,sentAt,message:(result.jaEnviado?'Esse pedido já teve o link enviado.':'Link enviado ao cliente. Pedido saiu para entrega.')+warning};
 }catch(e){return {ok:false,sentAt,message:e instanceof AgentError?e.message:'Não foi possível concluir. Confira o pedido antes de tentar novamente.'};}
}
