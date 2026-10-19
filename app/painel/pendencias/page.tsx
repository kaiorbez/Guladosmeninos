import { YangoForm } from '@/components/YangoForm';
import { compatibleReceipt } from '@/lib/agent/notices';
import { deliveryOrderForTicket } from '@/lib/agent/service';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ResolutionForm } from './ResolutionForm';
export const dynamic = 'force-dynamic';
export default async function Pendencias({searchParams}:{searchParams:Promise<{arquivo?:string}>}) {
  await requireSession();
  const archived=(await searchParams).arquivo==='1';
  const tickets = await prisma.agentTicket.findMany({ where: {status:archived?'RESOLVIDA':{in:['ABERTA','ASSUMIDA']}}, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200 });
  const linkedOrders=new Map(await Promise.all(tickets.filter(t=>compatibleReceipt(t.kind,t.question)).map(async t=>[t.id,await deliveryOrderForTicket(t)] as const)));
  return <main className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Pendências do atendimento</h1><p className="text-cacau-600">Dúvidas e comprovantes aguardando a equipe. Resolver libera a IA para a próxima mensagem do cliente.</p></div>
    <nav className="flex gap-4"><Link className={!archived?'font-semibold underline':''} href="/painel/pendencias">Pendentes</Link><Link className={archived?'font-semibold underline':''} href="/painel/pendencias?arquivo=1">Resolvidas / arquivo</Link></nav>
    {!tickets.length && <p>Nenhuma pendência registrada.</p>}
    {tickets.map(t => <article key={t.id} className="space-y-3 rounded-lg border border-creme-300 bg-white p-4">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{t.customerName} — {t.kind === 'COMPROVANTE' ? 'Conferir comprovante' : t.kind==='ENTREGA'?'Entrega / rastreio':'Dúvida'}</h2><span>{t.status === 'ABERTA' ? 'Aguardando equipe' : t.status === 'ASSUMIDA' ? 'Em atendimento · lembretes suspensos' : 'Resolvida'}</span></div>
      <Link className="underline" href={`https://wa.me/${t.phone}`} target="_blank" rel="noreferrer">Abrir conversa</Link>
      <p className="whitespace-pre-wrap">{t.question}</p>
      <p className="text-sm text-cacau-500">{t.createdAt.toLocaleString('pt-BR', { timeZone: 'America/La_Paz' })} · {t.reminderCount} lembrete(s)</p>
      {t.kind === 'COMPROVANTE' && <p className="font-medium">Resolver este aviso não confirma pagamento. Registre o valor recebido na encomenda após conferir o banco.</p>}
      {t.status === 'ASSUMIDA' && <p className="whitespace-pre-wrap">{t.answer || 'Equipe assumiu a conversa diretamente no WhatsApp.'}</p>}
      {t.status === 'RESOLVIDA' && <p className="whitespace-pre-wrap">{t.answer || 'Pendência encerrada pela equipe.'}</p>}
      {compatibleReceipt(t.kind,t.question)&&linkedOrders.get(t.id)?.deliveryMode==='ENTREGA'&&Number(linkedOrders.get(t.id)?.paid)>0&&linkedOrders.get(t.id)?.status!=='CANCELADA'&&<YangoForm ticketId={t.id} orderId={linkedOrders.get(t.id)?.id} sentAt={linkedOrders.get(t.id)?.deliveryLinkSentAt?.toISOString()}/>}
      <ResolutionForm id={t.id} archived={t.status==='RESOLVIDA'}/>

    </article>)}
  </main>;
}
