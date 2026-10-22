export class AgentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const text = (v: unknown, max = 1000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
/** Delivery/pickup times for scheduled orders (owners' rule, 16/10). Returns an error text or null. */
export function scheduledSlot(weekday: number, minutes: number) {
  const at=(h:number)=>h*60;
  switch(weekday){
    case 1: return minutes>=at(11)&&minutes<=at(20)?null:'Segunda-feira: encomendas agendadas das 11:00 às 20:00.';
    case 2: return [at(11),at(14),at(17)].includes(minutes)?null:'Terça-feira: entregas das encomendas antecipadas só às 11:00, 14:00 ou 17:00.';
    case 3: return minutes===at(10)||(minutes>=at(14)&&minutes<=at(20))?null:'Quarta-feira: encomendas agendadas às 10:00 ou das 14:00 às 20:00.';
    default: return minutes>=at(10)&&minutes<=at(20)?null:'Encomendas agendadas de quinta a domingo: das 10:00 às 20:00.';
  }
}
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
  if (u.protocol !== 'https:' || !(u.hostname === 'yango.com' || u.hostname.endsWith('.yango.com')) || !!u.username || !!u.password || !!u.port) throw new AgentError('Use um link HTTPS de acompanhamento em um domínio yango.com.');
  return u.toString();
}
export function resolvedCommand(v: unknown) {
  const s = text(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^(respondid[oa]|resolvid[oa]|duvida respondida|ja respondi|cliente respondido)[.!\s]*$/.test(s);
}
export type OrderLine = { descricao: string; quantidade: number; precoUnitario: number };
export function orderInput(raw: Record<string, unknown>, now = new Date(), existing?: { deliveryDate: Date; createdAt: Date; topping?: string | null; product?: string; deliveryTime?: string | null }) {
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
  if (mode === 'ENTREGA' && !text(raw.endereco, 1000)) throw new AgentError('ENDERECO_OBRIGATORIO: peça ao cliente o endereço ou a localização da entrega antes de registrar o pedido e enviar o QR.');
  const weekday=new Date(date+'T12:00:00Z').getUTCDay();
  const preserved = existing?.deliveryDate.toISOString().slice(0,10) === date;
  if(weekday===2 && mode!=='ENTREGA') throw new AgentError('Terça-feira: somente entrega de encomendas antecipadas; sem retirada presencial.');
  if(weekday===2 && date===dayLaPaz(now) && !(preserved && dayLaPaz(existing!.createdAt)<date)) throw new AgentError('Terça-feira: não aceitar nova compra para o mesmo dia pelo WhatsApp. Ofereça outra data ou PedidosYa. Encomendas antecipadas mantêm a entrega.');
  const chantilly = /chantil(?:ly|i)/i.test([raw.cobertura, ...lines.map(line=>line.descricao)].join(' '));
  const preservedChantilly = preserved && /chantil(?:ly|i)/i.test([existing?.topping, existing?.product].join(' '));
  if(chantilly && !preservedChantilly && Date.parse(date)-Date.parse(dayLaPaz(now))<2*86400000) throw new AgentError('Bolo com chantilly exige dois dias de antecedência. Compra na terça: oferecer quinta-feira ou depois, nunca quarta.');
  const immediate=raw.paraAgora===true || text(raw.horario,5).toUpperCase()==='AGORA';
  if(immediate) {
    const local=new Date(now.getTime()-4*3600000);
    const minutes=local.getUTCHours()*60+local.getUTCMinutes();
    const opens=weekday===1||weekday===3?14*60:10*60, closes=weekday===1||weekday===3?20*60:21*60;
    if(weekday===2 || date!==dayLaPaz(now) || minutes<opens || minutes>=closes)throw new AgentError('Pedido para agora exige hoje dentro do atendimento. Combine o próximo horário disponível.');
  }
  const time = immediate?'':text(raw.horario, 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new AgentError('Horário inválido.');
  if(time) {
    const minutes=Number(time.slice(0,2))*60+Number(time.slice(3));
    if(date===dayLaPaz(now) && weekday!==2) {
      // Same-day orders follow the service hours.
      const short=weekday===1||weekday===3;const opens=short?14*60:10*60;const closes=short?20*60:21*60;
      if(minutes<opens||minutes>=closes) throw new AgentError('Horário fora do atendimento: combine o primeiro horário disponível com o cliente.');
    } else {
      // An order already booked at this date and time keeps its slot even if the rule changed later.
      const reason=preserved&&existing?.deliveryTime===time?null:scheduledSlot(weekday,minutes);
      if(reason) throw new AgentError(reason);
    }
    const local=new Date(now.getTime()-4*3600000);if(date===dayLaPaz(now)&&minutes<=local.getUTCHours()*60+local.getUTCMinutes())throw new AgentError('Horário já passou: consulte equipe para confirmar disponibilidade.');
  }
  // Kit Mini Cumpleaños needs about six hours to print the customer's photos: same day only with that margin before the requested time and closing.
  if (lines.some(line => /mini\s*cumplea/i.test(line.descricao)) && date === dayLaPaz(now) && weekday !== 2) {
    const local = new Date(now.getTime() - 4 * 3600000);
    const ready = local.getUTCHours() * 60 + local.getUTCMinutes() + 360;
    const closes = weekday === 1 || weekday === 3 ? 20 * 60 : 21 * 60;
    const wanted = immediate ? ready - 1 : time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : ready;
    const hhmm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    if (ready >= closes) throw new AgentError('Kit Mini Cumpleaños precisa de cerca de 6 horas para imprimir as fotos e não fica pronto hoje. Ofereça o próximo dia de atendimento.');
    if (wanted < ready) throw new AgentError(`Kit Mini Cumpleaños precisa de cerca de 6 horas para imprimir as fotos: para hoje, o horário mínimo é ${hhmm(ready)}.`);
  }
  // Empadão M and G need about one hour in the oven: same-day orders must leave that hour before the requested time and before closing.
  const bigPie = lines.some(line => /empad[aã]o/i.test(line.descricao) && !/empadinha/i.test(line.descricao) && (/\b[MG]\b/.test(line.descricao) || /750\s*g|1[.,]?[23]\s*kg|1\.?[23]00\s*g|\bm[eé]dio\b|\bgrande\b/i.test(line.descricao)));
  if (bigPie && date === dayLaPaz(now) && weekday !== 2) {
    const local = new Date(now.getTime() - 4 * 3600000);
    const ready = local.getUTCHours() * 60 + local.getUTCMinutes() + 60;
    const closes = weekday === 1 || weekday === 3 ? 20 * 60 : 21 * 60;
    const wanted = immediate ? ready : time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : ready;
    const hhmm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    if (ready >= closes) throw new AgentError('Empadão M/G leva cerca de 1 hora para assar e não fica pronto antes do fechamento hoje. Ofereça o próximo dia de atendimento.');
    if (wanted < ready) throw new AgentError(`Empadão M/G leva cerca de 1 hora para assar: para hoje, o horário mínimo é ${hhmm(ready)}.`);
  }
  return { deliveryDate: new Date(date + 'T00:00:00Z'), deliveryTime: immediate ? 'AGORA' : time || null, deliveryMode: mode, deliveryAddress: text(raw.endereco, 1000) || null, agentItems: lines, product: lines.map(i => `${i.quantidade} × ${i.descricao} — ${i.precoUnitario} Bs`).join('\n'), total, payFull: raw.pagarIntegral === true, dough:text(raw.massa,200)||null,filling:text(raw.recheio,300)||null,topping:text(raw.cobertura,300)||null,decoration:text(raw.decoracao,1000)||null,notes: text(raw.observacoes, 2000) || null };
}
