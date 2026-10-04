import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { AgentError } from './rules';

export async function lockConversation(tx: Prisma.TransactionClient, phone: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
}
/** Durable claim first: a crash after sending leaves SENDING, never a blind retry. */
export async function sendOnce(id: string, target: string, message: string, ticketId?: string, generation?: number, media?: 'qr' | 'menu' | 'receipt-image' | 'receipt-pdf', sourceUrl?: string, failureReply = false) {
  // Send plain text consistently, including captions and model-generated replies.
  message = message.replace(/\*+/g, '');
  const instance = process.env.ZAPI_INSTANCE, token = process.env.ZAPI_TOKEN, client = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !client) throw new AgentError('Z-API não configurada no painel.', 503);
  const candidateUrl = sourceUrl || (media === 'qr' ? process.env.GULA_QR_URL : media === 'menu' ? process.env.GULA_MENU_URL : undefined);
  const mediaUrl = candidateUrl?.trim();
  if(mediaUrl) {let u:URL;try{u=new URL(mediaUrl);}catch{throw new AgentError('URL do arquivo inválida.');}if(u.protocol!=='https:')throw new AgentError('Arquivo precisa URL HTTPS.');}
  if (media && !mediaUrl) throw new AgentError('Arquivo não configurado no painel.', 503);
  const claim = await prisma.$transaction(async tx => {
    await lockConversation(tx, target);
    const old = await tx.agentDelivery.findUnique({ where: { key: id } });
    if (old) return { enviado: old.status === 'SENT', estado: old.status, messageId: old.messageId };
    await tx.agentDelivery.create({ data: { key: id, phone: target, ticketId, status: 'SENDING', body: { message, media: media || 'text' } } });
    return null;
  });
  if (claim) return claim;
  return prisma.$transaction(async tx => {
    await lockConversation(tx, target);
    if (generation !== undefined) {
      const c = await tx.agentConversation.findUnique({ where: { phone: target } });
      if (!c || c.generation !== generation || (!failureReply && c.pausedUntil && c.pausedUntil > new Date())) {
        await tx.agentDelivery.update({ where: { key: id }, data: { status: 'SUPERADA' } });
        return { enviado: false, estado: 'SUPERADA', messageId: null };
      }
    }
    if (ticketId && id.startsWith('reminder:')) {
      const t = await tx.agentTicket.findUnique({ where: { id: ticketId } });
      if (t) await lockConversation(tx, t.phone);
      const latest = t && await tx.agentTicket.findUnique({ where: { id: ticketId } });
      if (!latest || latest.status !== 'ABERTA') {
        await tx.agentDelivery.update({ where: { key: id }, data: { status: 'CANCELLED' } });
        return { enviado: false, estado: 'CANCELLED', messageId: null };
      }
    }
    const route = media === 'qr' || media === 'receipt-image' ? 'send-image' : media === 'menu' || media === 'receipt-pdf' ? 'send-document/pdf' : 'send-text';
    const body = media === 'qr' || media === 'receipt-image' ? { phone: target, image: mediaUrl, caption: message } : media === 'menu' || media === 'receipt-pdf' ? { phone: target, document: mediaUrl, fileName: media === 'receipt-pdf' ? 'Comprovante-Gula' : 'Cardapio-Gula-dos-Meninos', caption: message } : { phone: target, message };
    let status = 'UNKNOWN', messageId: string | null = null, error: string | null = null;
    try {
      const r = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(token)}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': client }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      const result = await r.json();
      if (r.ok && typeof (result.messageId || result.id) === 'string') { status = 'SENT'; messageId = result.messageId || result.id; }
      else { status = r.status >= 400 && r.status < 500 ? 'FAILED' : 'UNKNOWN'; error = `Resposta Z-API sem confirmação (${r.status})`; }
    } catch { error = 'Envio sem confirmação: conferir WhatsApp antes de repetir.'; }
    await tx.agentDelivery.update({ where: { key: id }, data: { status, messageId, error } });
    return { enviado: status === 'SENT', estado: status, messageId };
  }, { timeout: 20000 });
}
