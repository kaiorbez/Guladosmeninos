import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { AgentError } from './rules';

export async function lockConversation(tx: Prisma.TransactionClient, phone: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
}
/** Durable claim first: a crash after sending leaves SENDING, never a blind retry. */
export async function sendOnce(id: string, target: string, message: string, ticketId?: string, generation?: number, media?: 'qr' | 'menu' | 'receipt-image' | 'receipt-pdf', sourceUrl?: string, failureReply = false, qrOrder?: {id:string;version:number;total:number;paid:number}) {
  // Send plain text consistently, including captions and model-generated replies.
  message = message.replace(/\*+/g, '');
  if (target !== process.env.WHATSAPP_EQUIPE) message = message.replace(/\s*[\u2013\u2014]\s*/g, ', ');
  const instance = process.env.ZAPI_INSTANCE, token = process.env.ZAPI_TOKEN, client = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !client) throw new AgentError('Z-API não configurada no painel.', 503);
  const candidateUrl = sourceUrl || (media === 'qr' ? process.env.GULA_QR_URL : media === 'menu' ? process.env.GULA_MENU_URL : undefined);
  const mediaUrl = candidateUrl?.trim();
  if(mediaUrl) {let u:URL;try{u=new URL(mediaUrl);}catch{throw new AgentError('URL do arquivo inválida.');}if(u.protocol!=='https:')throw new AgentError('Arquivo precisa URL HTTPS.');}
  if (media && !mediaUrl) throw new AgentError('Arquivo não configurado no painel.', 503);
  const claim = await prisma.$transaction(async tx => {
    await lockConversation(tx, target);
    const old = await tx.agentDelivery.findUnique({ where: { key: id } });
    if (old) {
      if (old.phone !== target) throw new AgentError('Chave de envio pertence a outro destinatário.', 409);
      if (!['SUPERADA', 'FAILED', 'CANCELLED'].includes(old.status)) {
        return { enviado: old.status === 'SENT', estado: old.status, messageId: old.messageId };
      }
      // Only definite non-deliveries may be claimed again. The current generation
      // and reminder state are checked below, under the same lock used to send.
      await tx.agentDelivery.update({ where: { key: id }, data: {
        status: 'SENDING', ticketId: ticketId ?? null, messageId: null, error: null,
        body: { message, media: media || 'text' },
      } });
      return null;
    }
    await tx.agentDelivery.create({ data: { key: id, phone: target, ticketId, status: 'SENDING', body: { message, media: media || 'text' } } });
    return null;
  });
  if (claim) return claim;
  return prisma.$transaction(async tx => {
    await lockConversation(tx, target);
    if (generation !== undefined) {
      const c = await tx.agentConversation.findUnique({ where: { phone: target } });
      let unchangedQr = false;
      let validQrOrder = true;
      if (media === 'qr' && qrOrder) {
        const order = await tx.order.findFirst({where:{id:qrOrder.id,customerPhone:target,status:'PENDENTE'}});
        validQrOrder = !!order && order.agentVersion === qrOrder.version && Number(order.total) === qrOrder.total && Number(order.paid) === qrOrder.paid &&
          (order.deliveryMode !== 'ENTREGA' || !!order.deliveryAddress?.trim());
        if (validQrOrder && c && c.generation > generation && c.generation-generation <= 100) {
          const events = await tx.agentEvent.findMany({where:{phone:target,kind:'INBOUND'},orderBy:{createdAt:'desc'},take:100});
          const incoming = events.map(e=>e.payload as Record<string,unknown>).filter(e=>Number(e.generation)>generation&&Number(e.generation)<=c.generation);
          // Prove every intervening input is harmless. Unknown text, quotes, media,
          // payment receipts and human intervention require the normal re-evaluation.
          const covered = new Set(incoming.map(e=>Number(e.generation)));
          unchangedQr = covered.size === c.generation-generation && incoming.every(e=>{
            const text=String(e.text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[.!?¿¡]+$/g,'').trim();
            return e.fromMe === false && e.media === 'texto' && !e.quoted && /^(?:ok+|si+m*|sim+|si|gracias|obrigad[oa]|perfecto|perfeito|confirmo|confirmado|por favor|porfavor|aguardo|estou aguardando|sigo esperando|\?|(?:me )?(?:envia|envie|manda|mande|pasa|passe)(?:me)? (?:el |o )?qr(?: por ?favor)?)$/.test(text);
          });
        }
      }
      if (!c || !validQrOrder || (c.generation !== generation && !unchangedQr) || (!failureReply && c.pausedUntil && c.pausedUntil > new Date())) {
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
