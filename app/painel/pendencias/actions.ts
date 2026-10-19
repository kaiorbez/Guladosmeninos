'use server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveTicket } from '@/lib/agent/service';
import { syncPanelResume } from '@/lib/agent/ticket-resolution';
import { revalidatePath } from 'next/cache';
export async function resolve(_: {ok:boolean;message:string}|null, form: FormData) {
 const session=await requireSession();
 try {
  const id=String(form.get('id')||'');
  const result=await resolveTicket(id,String(form.get('resposta')||'').slice(0,4000),String(session.userId));
  const conversation=await prisma.agentConversation.findUnique({where:{phone:result.telefone}});
  if(conversation)await syncPanelResume(id,result.telefone,conversation.generation);
  revalidatePath('/painel/pendencias');
  return {ok:true,message:'Pendência resolvida. IA liberada para a próxima mensagem do cliente.'};
 }catch(e){const message=e instanceof Error&&/^(Aviso não encontrado|Liberação do atendimento|A pendência foi resolvida|A liberação não foi confirmada)/.test(e.message)?e.message:'Não foi possível resolver. Atualize a página e tente novamente.';return {ok:false,message};}
}
