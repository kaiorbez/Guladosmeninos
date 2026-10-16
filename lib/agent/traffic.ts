import { prisma } from '@/lib/db';
import { dayLaPaz } from './rules';

type Body = Record<string, unknown>;
type Ev = { phone: string; createdAt: Date; payload: unknown };
type Ord = { customerPhone: string | null; total: unknown; paid: unknown; product: string; deliveryDate: Date; agentRef: string | null; createdAt: Date };
type Sl = { customerPhone: string | null; total: unknown; createdAt: Date };
type Row = { encomendas: { total: number; pago: number }[]; vendas: { total: number }[] };
const HOUR = 3600000;
const TEST = '59175678921';

// Meta click-to-WhatsApp ads open the chat with this prefilled text (Spanish or Portuguese).
const AD_GREETING = /^(¡?hola!?,?\s*quiero m[aá]s informaci[oó]n|ol[aá]!?,?\s*(tenho interesse e )?quer(o|ia) mais informa[cç](ão|ões))/i;
export function isAdGreeting(text: unknown) {
  return AD_GREETING.test(String(text ?? '').trim());
}
const tail = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-8);

/** Read-only: customers whose first message in the period was the ad greeting, and what they bought. */
export async function trafficReport(b: Body, now = new Date()) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dia ?? '')) ? String(b.dia) : dayLaPaz(now);
  const days = Math.min(Math.max(Number(b.dias) || 1, 1), 31);
  const from = new Date(new Date(day + 'T04:00:00Z').getTime() - (days - 1) * 24 * HOUR), to = new Date(day + 'T04:00:00Z').getTime() + 24 * HOUR;
  const group = process.env.WHATSAPP_EQUIPE;
  const inbound = await prisma.agentEvent.findMany({ where: { kind: 'INBOUND', createdAt: { gte: from, lt: new Date(to) }, phone: { notIn: [TEST, ...(group ? [group] : [])] } }, orderBy: { createdAt: 'asc' }, select: { phone: true, createdAt: true, payload: true } });
  const first = new Map<string, { at: Date; text: string }>();
  for (const e of inbound as Ev[]) {
    const p = e.payload as Body;
    if (p?.fromMe === true || first.has(e.phone)) continue;
    first.set(e.phone, { at: e.createdAt, text: String(p?.text ?? '') });
  }
  // A customer only counts as a new ad lead when they had no conversation before the period.
  const leads = [...first].filter(([, f]) => isAdGreeting(f.text)).map(([phone, f]) => ({ phone, at: f.at }));
  const earlier = leads.length ? await prisma.agentEvent.findMany({ where: { kind: 'INBOUND', phone: { in: leads.map(l => l.phone) }, createdAt: { lt: from } }, select: { phone: true }, distinct: ['phone'] }) : [];
  const returning = new Set((earlier as { phone: string }[]).map(e => e.phone));
  const tails = leads.map(l => tail(l.phone));
  const [orders, sales] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: from }, status: { not: 'CANCELADA' } }, select: { customerPhone: true, total: true, paid: true, product: true, deliveryDate: true, agentRef: true, createdAt: true } }),
    prisma.sale.findMany({ where: { createdAt: { gte: from }, status: 'CONFIRMADA' }, select: { customerPhone: true, total: true, createdAt: true, externalRef: true } }),
  ]);
  const rows = leads.map(l => {
    const t = tail(l.phone);
    const o = (orders as Ord[]).filter((x: Ord) => tail(x.customerPhone) === t && x.createdAt >= l.at);
    const s = (sales as Sl[]).filter((x: Sl) => tail(x.customerPhone) === t && x.createdAt >= l.at);
    return {
      telefone: l.phone, chegou: l.at.toISOString(), clienteAntigo: returning.has(l.phone),
      encomendas: o.map((x: Ord) => ({ produto: x.product, total: Number(x.total), pago: Number(x.paid), entrega: x.deliveryDate.toISOString().slice(0, 10), pelaIA: !!x.agentRef })),
      vendas: s.map((x: Sl) => ({ total: Number(x.total) })),
    };
  });
  if (b.detalhe === true) {
    // Compact view of where each lead stopped: counts plus the last customer message and last reply, truncated.
    const cut = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
    for (const r of rows as (Row & Body)[]) {
      const phone = String(r.telefone);
      const evs = (inbound as Ev[]).filter(e => e.phone === phone);
      const customer = evs.filter(e => (e.payload as Body)?.fromMe !== true);
      const human = evs.filter(e => (e.payload as Body)?.fromMe === true);
      const reply = await prisma.agentDelivery.findFirst({ where: { phone, status: 'SENT', NOT: { key: { startsWith: 'followup:' } } }, orderBy: { createdAt: 'desc' }, select: { body: true, createdAt: true } });
      r.msgsCliente = customer.length;
      r.equipeEscreveu = human.length > 0;
      r.ultimaCliente = cut((customer.at(-1)?.payload as Body)?.text, 140);
      const lastHuman = human.at(-1);
      r.ultimaResposta = lastHuman && (!reply || lastHuman.createdAt > reply.createdAt) ? 'equipe: ' + cut((lastHuman.payload as Body)?.text, 140) : 'IA: ' + cut((reply?.body as Body)?.message, 140);
    }
  }
  const buyers = rows.filter(r => r.encomendas.length || r.vendas.length);
  const value = (rows as Row[]).reduce((sum: number, r: Row) => sum + r.encomendas.reduce((a: number, x) => a + x.total, 0) + r.vendas.reduce((a: number, x) => a + x.total, 0), 0);
  const paid = (rows as Row[]).reduce((sum: number, r: Row) => sum + r.encomendas.reduce((a: number, x) => a + x.pago, 0) + r.vendas.reduce((a: number, x) => a + x.total, 0), 0);
  return { ok: true, periodo: { de: from.toISOString(), ate: new Date(to).toISOString(), dias: days }, clientesNoPeriodo: first.size, leadsAnuncio: rows.length, leadsNovos: rows.filter(r => !r.clienteAntigo).length, compraram: buyers.length, valorPedidos: value, valorPago: paid, totalTelefonesComparados: tails.length, leads: rows };
}
