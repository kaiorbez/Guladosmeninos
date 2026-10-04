import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { resolve } from './actions';
export const dynamic = 'force-dynamic';
export default async function Pendencias() {
  await requireSession();
  const tickets = await prisma.agentTicket.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200 });
  const deliveries = await prisma.agentDelivery.findMany({ where: { status: { in: ['FAILED', 'UNKNOWN', 'SENDING'] } }, orderBy: { createdAt: 'desc' }, take: 30 });
  return <main className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Pendências do atendimento</h1><p className="text-cacau-600">Dúvidas e comprovantes aguardando a equipe. Resolver libera a IA para a próxima mensagem do cliente.</p></div>
    {deliveries.length > 0 && <section className="rounded-lg border border-amber-300 bg-amber-50 p-4"><h2 className="font-semibold">Envios sem confirmação</h2><p>Confira o WhatsApp antes de repetir um envio para evitar mensagens duplicadas.</p>{deliveries.map(d => <p key={d.key}>{d.phone}: {d.status} — {d.error || 'Sem confirmação de envio'}</p>)}</section>}
    {!tickets.length && <p>Nenhuma pendência registrada.</p>}
    {tickets.map(t => <article key={t.id} className="space-y-3 rounded-lg border border-creme-300 bg-white p-4">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{t.customerName} — {t.kind === 'COMPROVANTE' ? 'Conferir comprovante' : 'Dúvida'}</h2><span>{t.status === 'ABERTA' ? 'Aguardando equipe' : t.status === 'ASSUMIDA' ? 'Em atendimento · lembretes suspensos' : 'Resolvida'}</span></div>
      <Link className="underline" href={`https://wa.me/${t.phone}`} target="_blank" rel="noreferrer">Abrir conversa</Link>
      <p className="whitespace-pre-wrap">{t.question}</p>
      <p className="text-sm text-cacau-500">{t.createdAt.toLocaleString('pt-BR', { timeZone: 'America/La_Paz' })} · {t.reminderCount} lembrete(s)</p>
      {t.kind === 'COMPROVANTE' && <p className="font-medium">Resolver este aviso não confirma pagamento. Registre o valor recebido na encomenda após conferir o banco.</p>}
      {t.status === 'ASSUMIDA' && <p className="whitespace-pre-wrap">{t.answer || 'Equipe assumiu a conversa diretamente no WhatsApp.'}</p>}
      {t.status !== 'RESOLVIDA' ? <form action={resolve} className="space-y-2"><input type="hidden" name="id" value={t.id}/><label className="block">Resposta dada ao cliente (opcional)<textarea className="block w-full rounded border p-2" name="resposta" maxLength={4000}/></label><button className="rounded bg-cacau-800 px-4 py-2 text-white">Marcar como respondida</button></form> : <p className="whitespace-pre-wrap">{t.answer || 'Equipe marcou como respondida; conteúdo da resposta não informado.'}</p>}
    </article>)}
  </main>;
}
