import { prisma } from '@/lib/db';
import { text } from './rules';

/** Importa somente dados devolvidos pela Z-API. Falha não é confundida com histórico vazio. */
export async function importHistory(phone: string) {
  const id = `history-v2:${phone}`;
  if (await prisma.agentEvent.findUnique({ where: { key: id } })) return;
  const instance = process.env.ZAPI_INSTANCE, token = process.env.ZAPI_TOKEN, client = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !client) return;
  try {
    const r = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(token)}/chat-messages/${phone}?amount=100`, { headers: { 'Client-Token': client }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const raw = await r.json();
    const messages = Array.isArray(raw) ? raw : Array.isArray(raw.data) ? raw.data : null;
    if (!messages) return;
    await prisma.$transaction(async tx => {
      for (const m of messages.slice(0, 100)) {
        if (!m || m.isGroup || !m.messageId || m.reaction) continue;
        const id = String(m.messageId).slice(0, 180);
        const content = text(m.text?.message, 12000) || (m.location ? '[Localização recebida: https://maps.google.com/?q='+m.location.latitude+','+m.location.longitude+' '+text(m.location.address,1000)+']' : m.image ? '[Imagem anterior: conteúdo não analisado]' : m.document ? '[Documento anterior: conteúdo não analisado]' : m.audio ? '[Áudio anterior: conteúdo não transcrito]' : '');
        if (!content) continue;
        const n = Number(m.moment || m.momment);
        if (!Number.isFinite(n) || n <= 0) continue;
        const at = new Date(n < 1e12 ? n * 1000 : n);
        await tx.agentEvent.upsert({ where: { key: `history-msg:${phone}:${id}` }, create: { key: `history-msg:${phone}:${id}`, phone, kind: 'HISTORY', payload: { text: content, fromMe: m.fromMe === true || m.fromMe === 'true', messageId: id }, createdAt: at }, update: {payload:{text:content,fromMe:m.fromMe===true||m.fromMe==='true',messageId:id}} });
      }
      await tx.agentEvent.upsert({ where: { key: id }, create: { key: id, phone, kind: 'HISTORY_LOADED', payload: { limit: 100 } }, update: {} });
    });
  } catch { /* contexto informa explicitamente se houve importação */ }
}
