import { prisma } from '@/lib/db';
import { sendOnce } from './transport';
import { dayLaPaz } from './rules';

type Body = Record<string, unknown>;
type Ev = { phone: string; createdAt: Date; payload: unknown };
type Ord = { total: unknown; paid: unknown };
const TEST = '59175678921';
const HOUR = 3600000;
// Same opening hours the agent uses (America/La_Paz, UTC-4). Tuesday has no WhatsApp sales.
const HOURS: Record<number, [number, number]> = { 1: [14, 20], 3: [14, 20], 4: [10, 21], 5: [10, 21], 6: [10, 21], 7: [10, 21] };

export function storeOpen(now = new Date()) {
  const local = new Date(now.getTime() - 4 * HOUR);
  const window = HOURS[local.getUTCDay() || 7];
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  // Leave the last 30 minutes free so a reply can still be handled before closing.
  return !!window && minutes >= window[0] * 60 && minutes < window[1] * 60 - 30;
}

const SPANISH = /[¿¡]|\b(hola|tenemos|quieres|deseas|cuant[oa]s?|precio|gracias|para qu[eé]|te quedó|puedes|necesitas|fecha)\b/i;
export function followUpText(lastReply: string) {
  return SPANISH.test(lastReply)
    ? '¡Hola! ¿Te quedó alguna duda? Si quieres, te ayudo a finalizar tu pedido 😊'
    : 'Oi! Ficou alguma dúvida? Se quiser, te ajudo a finalizar seu pedido 😊';
}

export type FollowUpFacts = {
  phone: string;
  lastCustomerAt: Date | null;
  lastReplyAt: Date | null;
  lastReply: string;
  humanAfterCustomer: boolean;
  recentOrder: boolean;
  openTicket: boolean;
  paused: boolean;
  followUpLastWeek: boolean;
};

/** One gentle reminder only: the AI gave a price, the customer went quiet 3 to 20 hours ago and nothing else is pending. */
export function followUpDecision(f: FollowUpFacts, now = new Date()) {
  if (f.phone === TEST || f.phone === process.env.WHATSAPP_EQUIPE) return 'contato interno';
  if (!f.lastCustomerAt || !f.lastReplyAt) return 'sem conversa';
  const quiet = now.getTime() - f.lastCustomerAt.getTime();
  if (quiet < 3 * HOUR) return 'cliente falou há menos de 3 h';
  if (quiet > 20 * HOUR) return 'fora da janela de 20 h';
  if (f.lastReplyAt <= f.lastCustomerAt) return 'última mensagem é do cliente';
  if (!/\bBs\b/i.test(f.lastReply) || /\[SEM_RESPOSTA\]|Obrigada por escolher|Gracias por elegir|já está sendo preparado|ya se está preparando|em preparação|en preparación/i.test(f.lastReply)) return 'IA não passou preço';
  if (f.humanAfterCustomer) return 'equipe assumiu';
  if (f.recentOrder) return 'já tem pedido';
  if (f.openTicket) return 'pendência aberta com a equipe';
  if (f.paused) return 'atendimento pausado';
  if (f.followUpLastWeek) return 'já recebeu lembrete nesta semana';
  return null;
}

export async function salesFollowUps(b: Body, now = new Date()) {
  const dryRun = b.simular === true;
  if (!dryRun && !storeOpen(now)) return { ok: true, enviados: [], motivo: 'fora do horário de envio' };
  const since = new Date(now.getTime() - 20 * HOUR);
  const inbound = await prisma.agentEvent.findMany({ where: { kind: 'INBOUND', createdAt: { gte: since } }, select: { phone: true }, distinct: ['phone'] });
  const results: Body[] = [];
  let sent = 0;
  for (const { phone } of inbound) {
    const [events, replies, orders, tickets, conversation, previous] = await Promise.all([
      prisma.agentEvent.findMany({ where: { phone, kind: 'INBOUND', createdAt: { gte: new Date(now.getTime() - 48 * HOUR) } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.agentDelivery.findMany({ where: { phone, status: 'SENT', NOT: { key: { startsWith: 'followup:' } } }, orderBy: { createdAt: 'desc' }, take: 1 }),
      prisma.order.count({ where: { customerPhone: phone, createdAt: { gte: new Date(now.getTime() - 48 * HOUR) } } }),
      prisma.agentTicket.count({ where: { phone, status: { in: ['ABERTA', 'ASSUMIDA'] } } }),
      prisma.agentConversation.findUnique({ where: { phone } }),
      prisma.agentDelivery.count({ where: { phone, key: { startsWith: 'followup:' }, createdAt: { gte: new Date(now.getTime() - 7 * 24 * HOUR) } } }),
    ]);
    const customer = (events as Ev[]).find((e: Ev) => (e.payload as Body)?.fromMe !== true);
    const human = (events as Ev[]).find((e: Ev) => (e.payload as Body)?.fromMe === true);
    const reply = replies[0];
    const lastReply = String((reply?.body as Body)?.message ?? '');
    const facts: FollowUpFacts = {
      phone,
      lastCustomerAt: customer?.createdAt ?? null,
      lastReplyAt: reply?.createdAt ?? null,
      lastReply,
      humanAfterCustomer: !!(human && customer && human.createdAt > customer.createdAt),
      recentOrder: orders > 0,
      openTicket: tickets > 0,
      paused: !!(conversation?.pausedUntil && conversation.pausedUntil > now),
      followUpLastWeek: previous > 0,
    };
    const reason = followUpDecision(facts, now);
    if (reason) continue;
    const message = followUpText(lastReply);
    if (dryRun || sent >= 20) { results.push({ telefone: phone, mensagem: message, simulado: true }); continue; }
    try {
      const r = await sendOnce(`followup:${phone}:${dayLaPaz(now)}`, phone, message, undefined, conversation?.generation ?? 0);
      if (r.enviado) sent++;
      results.push({ telefone: phone, ...r });
    } catch { results.push({ telefone: phone, enviado: false }); }
  }
  return { ok: true, simulado: dryRun, enviados: results };
}

export type DayStats = {
  day: string; customers: number; aiOrders: number; aiTotal: number; paidOrders: number;
  followUps: number; followUpOrders: number; takeovers: number; openTickets: number; newTickets: number;
};
const money = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export function summaryText(s: DayStats) {
  const [, m, d] = s.day.split('-');
  return [
    `📊 Resumo do dia ${d}/${m} (atendimento da IA)`,
    '',
    `👥 Clientes atendidos: ${s.customers}`,
    `🛒 Encomendas registradas pela IA: ${s.aiOrders}${s.aiOrders ? ` (Bs ${money(s.aiTotal)})` : ''}`,
    `💰 Dessas, com pagamento registrado: ${s.paidOrders}`,
    `🔔 Lembretes enviados a quem sumiu: ${s.followUps}${s.followUps ? ` (viraram pedido: ${s.followUpOrders})` : ''}`,
  ].join('\n');
}

export async function dailySummary(b: Body, now = new Date()) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dia ?? '')) ? String(b.dia) : dayLaPaz(now);
  const from = new Date(day + 'T04:00:00Z'), to = new Date(from.getTime() + 24 * HOUR);
  const group = process.env.WHATSAPP_EQUIPE;
  const internal = [TEST, ...(group ? [group] : [])];
  const [inbound, aiOrders, takeovers, openTickets, newTickets, followUps] = await Promise.all([
    prisma.agentEvent.findMany({ where: { kind: 'INBOUND', createdAt: { gte: from, lt: to }, phone: { notIn: internal } }, select: { phone: true, payload: true } }),
    prisma.order.findMany({ where: { agentRef: { not: null }, createdAt: { gte: from, lt: to }, customerPhone: { notIn: internal }, status: { not: 'CANCELADA' } }, select: { total: true, paid: true } }),
    prisma.agentEvent.findMany({ where: { kind: 'TEAM_TAKEOVER', createdAt: { gte: from, lt: to } }, select: { phone: true }, distinct: ['phone'] }),
    prisma.agentTicket.count({ where: { status: { in: ['ABERTA', 'ASSUMIDA'] }, phone: { notIn: internal } } }),
    prisma.agentTicket.count({ where: { createdAt: { gte: from, lt: to }, phone: { notIn: internal } } }),
    prisma.agentDelivery.findMany({ where: { key: { startsWith: 'followup:' }, status: 'SENT', createdAt: { gte: from, lt: to } }, select: { phone: true, createdAt: true } }),
  ]);
  let followUpOrders = 0;
  for (const f of followUps) if (await prisma.order.count({ where: { customerPhone: f.phone, createdAt: { gt: f.createdAt } } })) followUpOrders++;
  const stats: DayStats = {
    day,
    customers: new Set((inbound as Ev[]).filter((e: Ev) => (e.payload as Body)?.fromMe !== true).map((e: Ev) => e.phone)).size,
    aiOrders: aiOrders.length,
    aiTotal: (aiOrders as Ord[]).reduce((s: number, o: Ord) => s + Number(o.total), 0),
    paidOrders: (aiOrders as Ord[]).filter((o: Ord) => Number(o.paid) > 0).length,
    followUps: followUps.length,
    followUpOrders,
    takeovers: takeovers.length,
    openTickets,
    newTickets,
  };
  const message = summaryText(stats);
  if (b.simular === true) return { ok: true, simulado: true, mensagem: message, dados: stats };
  const target = b.destinoTeste === TEST ? TEST : group;
  if (!target) return { ok: false, error: 'Grupo da equipe não configurado.' };
  const sent = await sendOnce(`daily-summary:${day}${target === TEST ? ':teste' : ''}`, target, message);
  return { ok: true, mensagem: message, ...sent };
}
