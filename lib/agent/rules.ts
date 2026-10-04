export class AgentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const text = (v: unknown, max = 1000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export function phone(v: unknown) {
  const p = text(v, 40).replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(p)) throw new AgentError('Telefone internacional inválido.');
  return p;
}
export function key(v: unknown) {
  const k = text(v, 180);
  if (!k || !/^[\w:./@+-]+$/.test(k)) throw new AgentError('Referência da mensagem obrigatória.');
  return k;
}
export function dayLaPaz(now = new Date()) {
  return new Date(now.getTime() - 4 * 3600000).toISOString().slice(0, 10);
}
export function dateOnly(v: unknown) {
  const s = text(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw new AgentError('Data inválida; use YYYY-MM-DD.');
  return s;
}
export function money(v: unknown) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 9999999.99) throw new AgentError('Valor monetário inválido.');
  return Math.round(v * 100) / 100;
}
export function paymentPlan(total: number, paid: number, date: string, full = false, now = new Date()) {
  total = money(total); paid = money(paid);
  const percent = date <= dayLaPaz(now) || full ? 100 : 50;
  const target = Math.round(total * percent) / 100;
  return { percentual: percent, total, pagoConfirmado: paid, pagarAgora: Math.max(0, Math.round((target - paid) * 100) / 100), saldo: Math.max(0, Math.round((total - paid) * 100) / 100) };
}
export function yangoUrl(v: unknown) {
  const s = text(v, 2000); let u: URL;
  try { u = new URL(s); } catch { throw new AgentError('Link Yango inválido.'); }
  if (u.protocol !== 'https:' || u.hostname !== 'delivery.yango.com' || !u.pathname.startsWith('/route/')) throw new AgentError('Use o link de acompanhamento da Yango.');
  return u.toString();
}
export function resolvedCommand(v: unknown) {
  const s = text(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^(respondid[oa]|resolvid[oa]|duvida respondida|ja respondi|cliente respondido)[.!\s]*$/.test(s);
}
export type OrderLine = { descricao: string; quantidade: number; precoUnitario: number };
export function orderInput(raw: Record<string, unknown>, now = new Date()) {
  const date = dateOnly(raw.data);
  if (date < dayLaPaz(now)) throw new AgentError('Data passada: consulte a encomenda existente antes de criar outra.');
  const items = raw.itens;
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new AgentError('Informe de 1 a 50 itens.');
  const lines: OrderLine[] = items.map(i => {
    if (!i || typeof i !== 'object') throw new AgentError('Item inválido.');
    const descricao = text(i.descricao, 300), quantidade = i.quantidade;
    if (!descricao || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 1000) throw new AgentError('Descrição e quantidade são obrigatórias.');
    return { descricao, quantidade, precoUnitario: money(i.precoUnitario) };
  });
  const total = money(lines.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0));
  if (total <= 0) throw new AgentError('Preço precisa ser definido antes de registrar.');
  const mode = text(raw.modalidade, 20);
  if (!['ENTREGA', 'RETIRADA'].includes(mode)) throw new AgentError('Defina entrega ou retirada.');
  const weekday=new Date(date+'T12:00:00Z').getUTCDay();
  if(weekday===2) throw new AgentError('Terça-feira: WhatsApp aceita encomendas para outros dias; pedidos do dia pelo PedidosYa.');
  const immediate=raw.paraAgora===true || text(raw.horario,5).toUpperCase()==='AGORA';
  if(immediate) {
    const local=new Date(now.getTime()-4*3600000);
    const minutes=local.getUTCHours()*60+local.getUTCMinutes();
    const opens=weekday===1||weekday===3?14*60:10*60, closes=weekday===1||weekday===3?20*60:21*60;
    if(date!==dayLaPaz(now) || minutes<opens || minutes>=closes)throw new AgentError('Pedido para agora exige hoje dentro do atendimento. Combine o próximo horário disponível.');
  }
  const time = immediate?'':text(raw.horario, 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new AgentError('Horário inválido.');
  if(time) {
    const minutes=Number(time.slice(0,2))*60+Number(time.slice(3));const opens=weekday===1||weekday===3?14*60:10*60;const closes=weekday===1||weekday===3?20*60:21*60;
    if(minutes<opens||minutes>=closes) throw new AgentError('Horário fora do atendimento: combine o primeiro horário disponível com o cliente.');
    const local=new Date(now.getTime()-4*3600000);if(date===dayLaPaz(now)&&minutes<=local.getUTCHours()*60+local.getUTCMinutes())throw new AgentError('Horário já passou: consulte equipe para confirmar disponibilidade.');
  }
  return { deliveryDate: new Date(date + 'T00:00:00Z'), deliveryTime: immediate ? 'AGORA' : time || null, deliveryMode: mode, deliveryAddress: text(raw.endereco, 1000) || null, agentItems: lines, product: lines.map(i => `${i.quantidade} × ${i.descricao} — ${i.precoUnitario} Bs`).join('\n'), total, payFull: raw.pagarIntegral === true, dough:text(raw.massa,200)||null,filling:text(raw.recheio,300)||null,topping:text(raw.cobertura,300)||null,decoration:text(raw.decoracao,1000)||null,notes: text(raw.observacoes, 2000) || null };
}
