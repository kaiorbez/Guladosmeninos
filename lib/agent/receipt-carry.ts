type Inbox = { phone: string; messageId: string; mediaKind: string; ready: boolean; content: string | null; createdAt: Date };
type Event = { key: string; phone: string; kind: string; payload: unknown };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

/** Only an actual, analyzed, recent incoming receipt may cross a generation boundary. */
export function unsettledReceiptMedia(phone: string, inbox: Inbox[], events: Event[], now = new Date()) {
  const settled = new Set(events.filter(e => e.phone === phone && e.kind === 'RECEIPT_PAYMENT').map(e => String(object(e.payload).mediaId)));
  return inbox.filter(m => {
    if (m.phone !== phone || !m.ready || !['imagem', 'pdf'].includes(m.mediaKind) || settled.has(m.messageId)) return false;
    const age = now.getTime() - m.createdAt.getTime();
    if (age < 0 || age > 10 * 60000) return false;
    const type = /Tipo\s*:\s*(COMPROVANTE_BANCARIO|OUTRA_IMAGEM|REFERENCIA_BOLO)/i.exec(m.content || '')?.[1];
    if (type !== 'COMPROVANTE_BANCARIO') return false;
    const source = events.find(e => e.key === `in:${phone}:${m.messageId}` && e.phone === phone && e.kind === 'INBOUND');
    const payload = object(source?.payload);
    return payload.fromMe === false && ['imagem', 'pdf'].includes(String(payload.media)) && typeof payload.sourceUrl === 'string' && payload.sourceUrl.startsWith('https://');
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
}
