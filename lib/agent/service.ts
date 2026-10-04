import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { AgentError, dateOnly, dayLaPaz, key, orderInput, paymentPlan, phone, resolvedCommand, text, yangoUrl } from './rules';
import { lockConversation, sendOnce } from './transport';
import { importHistory } from './history';

type Body = Record<string, unknown>;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const group = () => { const g = process.env.WHATSAPP_EQUIPE; if (!g) throw new AgentError('Grupo da equipe não configurado.', 503); return g; };
function presentOrder(o: { id: string; number: number; customerName: string; product: string; total: unknown; paid: unknown; deliveryDate: Date; payFull: boolean; [k: string]: unknown }) {
  return { id: o.id, numero: o.number, cliente: o.customerName, produto: o.product, itens: o.agentItems, data: o.deliveryDate.toISOString().slice(0, 10), horario: o.deliveryTime, modalidade: o.deliveryMode, endereco: o.deliveryAddress, situacao: o.status, versao: o.agentVersion, observacoes: o.notes, ...paymentPlan(Number(o.total), Number(o.paid), o.deliveryDate.toISOString().slice(0, 10), o.payFull) };
}
export async function context(p: string) {
  const [orders, tickets, conversation, inbox, sent, events, imported] = await Promise.all([
    prisma.order.findMany({ where: { customerPhone: p }, orderBy: [{ deliveryDate: 'desc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.agentTicket.findMany({ where: { phone: p }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.agentConversation.findUnique({ where: { phone: p } }),
    prisma.agentInbox.findMany({ where:{phone:p,ready:true},orderBy:{moment:'desc'},take:80 }),
    prisma.agentDelivery.findMany({ where:{phone:p,status:'SENT'},orderBy:{createdAt:'desc'},take:80 }),
    prisma.agentEvent.findMany({ where:{phone:p,kind:{in:['HISTORY','INBOUND']}},orderBy:{createdAt:'desc'},take:100 }),
    prisma.agentEvent.findUnique({where:{key:`history:${p}`}}),
  ]);
  const liveIds=new Set(inbox.map(m=>m.messageId));
  const history=[...inbox.map(m=>({papel:'cliente',texto:m.content,data:new Date(Number(m.moment)).toISOString()})),...sent.map(m=>({papel:'atendente',texto:(m.body as Body).message,data:m.createdAt.toISOString()})),...events.filter(m=>{const v=m.payload as Body;return (m.kind==='HISTORY'&&!liveIds.has(String(v.messageId))) || (m.kind==='INBOUND'&&v.fromMe===true);}).map(m=>({papel:(m.payload as Body).fromMe?'atendente':'cliente',texto:(m.payload as Body).text,data:m.createdAt.toISOString()}))].sort((a,b)=>a.data.localeCompare(b.data)).slice(-100);
  return { ok: true, historico:history, historicoWhatsappImportado:!!imported, hoje: dayLaPaz(), pedidos: orders.map(presentOrder), pendencias: tickets, geracao: conversation?.generation ?? 0, pausado: !!(conversation?.pausedUntil && conversation.pausedUntil > new Date()), limiteConsulta: 100 };
}
async function current(tx: Prisma.TransactionClient, p: string, b: Body) {
  const c = await tx.agentConversation.findUnique({ where: { phone: p } });
  if (!c || !Number.isInteger(b.geracao) || c.generation !== b.geracao || (c.pausedUntil && c.pausedUntil > new Date())) throw new AgentError('Nova mensagem ou atendimento humano: reavaliar antes de agir.', 409);
}
export async function inbound(b: Body) {
  const p = phone(b.telefone), id = key(b.messageId);
  const n = Number(b.momento);
  const moment = Number.isFinite(n) && n > 0 ? Math.round(n < 1e12 ? n * 1000 : n) : Date.now();
  if (moment > Date.now() + 300000) throw new AgentError('Data da mensagem inválida.');
  const duplicate = await prisma.$transaction(async tx => {
    await lockConversation(tx, p);
    const eventKey = `in:${p}:${id}`;
    if (await tx.agentEvent.findUnique({ where: { key: eventKey } })) return true;
    await tx.agentEvent.create({ data: { key: eventKey, phone: p, kind: 'INBOUND', payload: json({ text: text(b.texto, 12000), media: ['imagem', 'pdf', 'localizacao', 'texto', 'audio'].includes(String(b.midia)) ? b.midia : 'outro', fromMe: b.humano === true, moment }) } });
    const c = await tx.agentConversation.findUnique({ where: { phone: p } });
    if (c && BigInt(moment) < c.latestMoment) return true;
    if (b.humano !== true) await tx.agentInbox.create({ data: { id:eventKey, phone:p, messageId:id, mediaKind:String(b.midia || 'outro'), moment:BigInt(moment) } });
    await tx.agentConversation.upsert({ where: { phone: p }, create: { phone: p, generation: 1, latestMoment: BigInt(moment), pausedUntil: b.humano === true ? new Date(Date.now() + 30 * 60000) : null }, update: { generation: { increment: 1 }, latestMoment: BigInt(moment), ...(b.humano === true ? { pausedUntil: new Date(Date.now() + 30 * 60000) } : {}) } });
    return false;
  });
  return { ...(await context(p)), ignorar: duplicate };
}
export async function saveOrder(b: Body) {
  const p = phone(b.telefone), source = key(b.messageId), input = b.pedido;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AgentError('Pedido inválido.');
  const raw = input as Body, orderId = text(raw.id, 100), name = text(raw.cliente, 120);
  if (!name) throw new AgentError('Nome do cliente obrigatório.');
  const data = orderInput(raw);
  const eventKey = `order:${p}:${source}`;
  const result = await prisma.$transaction(async tx => {
    await lockConversation(tx, p);
    const old = await tx.agentEvent.findUnique({ where: { key: eventKey } });
    if (old?.result) return old.result;
    await current(tx, p, b);
    let order;
    if (orderId) {
      const existing = await tx.order.findFirst({ where: { id: orderId, customerPhone: p, status: 'PENDENTE' } });
      if (!existing) throw new AgentError('Encomenda deste cliente não encontrada ou encerrada.', 404);
      if (data.total < Number(existing.paid)) throw new AgentError('Total menor que o pagamento confirmado; equipe deve ajustar.', 409);
      const result = await tx.order.updateMany({ where: { id: orderId, customerPhone: p, status: 'PENDENTE', agentVersion: Number(raw.versao) }, data: { ...data, customerName: name, agentVersion: { increment: 1 } } });
      if (!result.count) throw new AgentError('Pedido foi alterado; consulte novamente.', 409);
      order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    } else {
      // Retries e novo texto de confirmação não recriam o mesmo pedido pendente.
      order = await tx.order.findFirst({ where: { customerPhone: p, status: 'PENDENTE', product: data.product, deliveryDate: data.deliveryDate, total: data.total } });
      if (!order) order = await tx.order.create({ data: { ...data, customerName: name, customerPhone: p, agentRef: eventKey, channel: 'WHATSAPP', paid: 0 } });
    }
    const result = { ok: true, registrado: true, pedido: presentOrder(order), pagamentoConfirmado: false };
    await tx.agentEvent.create({ data: { key: eventKey, phone: p, kind: 'ORDER', payload: json(raw), result: json(result) } });
    return result;
  });
  const saved = result as unknown as {ok:boolean;registrado:boolean;pedido:{id:string;numero:number;produto:string;data:string;horario:string|null;total:number;pagarAgora:number;versao:number}};
  try {
    const o=saved.pedido;
    const t=await prisma.agentTicket.upsert({where:{sourceKey:`order:${o.id}`},create:{sourceKey:`order:${o.id}`,phone:p,customerName:name,kind:'PEDIDO',question:`Encomenda #${o.numero} — ${o.data} ${o.horario||''}\n${o.produto}\nTotal: ${o.total} Bs. Pagar agora: ${o.pagarAgora} Bs. Pagamento pendente de conferência.`,nextReminderAt:new Date(Date.now()+10*60000)},update:{}});
    const sent=await sendOnce(`order-notice:${o.id}:${o.versao}`,group(),`🛒 GULA — Encomenda #${o.numero}\nCliente: ${name}\nwa.me/${p}\n${o.data} ${o.horario||''}\n${o.produto}\nTotal: ${o.total} Bs. Pagar agora: ${o.pagarAgora} Bs.\nPagamento pendente de conferência.\nResponda este aviso com o link da Yango para encaminhar ao cliente.`,t.id);
    return {...saved,notificacaoEnviada:sent.enviado};
  } catch { return {...saved,notificacaoEnviada:false}; }

}
export async function ticket(b: Body) {
  const p = phone(b.telefone), id = key(b.messageId), question = text(b.pergunta, 4000), kind = b.tipo === 'COMPROVANTE' ? 'COMPROVANTE' : 'DUVIDA';
  if (!question) throw new AgentError('Informe a dúvida ou os dados do comprovante.');
  const t = await prisma.$transaction(async tx => {
    await lockConversation(tx, p);
    await current(tx, p, b);
    if (kind === 'COMPROVANTE') {
      const ids = Array.isArray(b.mediaIds) ? b.mediaIds.slice(0, 20).map(key) : [];
      if (!ids.length) throw new AgentError('Sem imagem/PDF recebido neste lote.');
      const media = await tx.agentEvent.findMany({ where: { key: { in: ids.map(m => `in:${p}:${m}`) }, phone: p, kind: 'INBOUND' } });
      const recent = media.some(m => { const payload = m.payload as Body; return ['imagem', 'pdf'].includes(String(payload.media)) && payload.fromMe === false && m.createdAt.getTime() > Date.now() - 10 * 60000; });
      if (!recent) throw new AgentError('Localização, texto ou mídia antiga não é comprovante atual.');
    }
    const sourceKey = `ticket:${p}:${kind}:${id}`;
    return tx.agentTicket.upsert({ where: { sourceKey }, create: { sourceKey, phone: p, customerName: text(b.cliente, 120) || p, question, kind, nextReminderAt: new Date(Date.now() + 10 * 60000) }, update: {} });
  });
  let sent: { enviado: boolean; estado: string; messageId: string | null };
  try { sent = await sendOnce(`ticket:${t.id}`, group(), `🔔 GULA — ${t.kind}\nCliente: ${t.customerName}\nwa.me/${t.phone}\n\n${t.question}\n\nResponda este aviso com “Respondido”, “Resolvido” ou com o link da Yango.`, t.id); }
  catch { sent = { enviado: false, estado: 'NAO_CONFIGURADO', messageId: null }; }
  return { ok: true, registrado: true, ticketId: t.id, tipo: t.kind, notificacaoEnviada: sent.enviado, estadoEnvio: sent.estado, messageId: sent.messageId };
}
export async function resolveTicket(id: string, answer: string, who: string) {
  return prisma.$transaction(async tx => {
    const t = await tx.agentTicket.findUnique({ where: { id } });
    if (!t) throw new AgentError('Aviso não encontrado.', 404);
    await lockConversation(tx, t.phone);
    await tx.agentTicket.updateMany({ where: { id, status: 'ABERTA' }, data: { status: 'RESOLVIDA', answer: answer || null, resolvedBy: who, resolvedAt: new Date() } });
    await tx.agentConversation.updateMany({ where: { phone: t.phone }, data: { pausedUntil: null, generation: { increment: 1 } } });
    return { ok: true, telefone: t.phone, retomado: true };
  });
}
export async function team(b: Body) {
  if (String(b.grupo) !== group()) throw new AgentError('Grupo não autorizado.', 403);
  const ref = key(b.referenceMessageId), id = key(b.messageId), message = text(b.texto, 3000);
  const delivery = await prisma.agentDelivery.findUnique({ where: { messageId: ref } });
  if (!delivery?.ticketId) throw new AgentError('Responda a um aviso do agente vinculado ao cliente.', 404);
  const t = await prisma.agentTicket.findUniqueOrThrow({ where: { id: delivery.ticketId } });
  if (resolvedCommand(message)) return resolveTicket(t.id, '', 'grupo');
  const link = yangoUrl(message.match(/https:\/\/\S+/)?.[0]);
  const sent = await sendOnce(`yango:${t.id}:${link}`, t.phone, `🚚 Acompanhe sua entrega / Sigue tu entrega:\n${link}\n\nObrigado pela compra! / ¡Gracias por tu compra! 💛`, t.id);
  if (!sent.enviado) return { ok: false, telefone: t.phone, ...sent, error: 'Envio não confirmado; verificar antes de repetir.' };
  await resolveTicket(t.id, `Link Yango enviado: ${link}`, 'grupo');
  await prisma.agentEvent.upsert({ where: { key: `team:${id}` }, create: { key: `team:${id}`, phone: t.phone, kind: 'DELIVERY_LINK', payload: { link }, result: { enviado: true } }, update: {} });
  return { ok: true, telefone: t.phone, enviado: true, encerrado: true };
}
export async function reminders() {
  const due = await prisma.agentTicket.findMany({ where: { status: 'ABERTA', kind: { in: ['DUVIDA','COMPROVANTE'] }, reminderCount: { lt: 3 }, nextReminderAt: { lte: new Date() } }, take: 30 });
  const results = [];
  for (const t of due) {
    const claim = await prisma.agentTicket.updateMany({ where: { id: t.id, status: 'ABERTA', reminderCount: t.reminderCount, nextReminderAt: t.nextReminderAt }, data: { nextReminderAt: new Date(Date.now() + 10 * 60000) } });
    if (!claim.count) continue;
    const latest = await prisma.agentTicket.findUniqueOrThrow({ where: { id: t.id } });
    if (latest.status !== 'ABERTA') continue;
    try {
      const sent = await sendOnce(`reminder:${t.id}:${t.reminderCount}`, group(), `⏰ Dúvida ainda pendente — ${t.customerName}\nwa.me/${t.phone}\n${t.question}`, t.id);
      if (sent.enviado) await prisma.agentTicket.updateMany({ where: { id: t.id, status: 'ABERTA', reminderCount: t.reminderCount }, data: { reminderCount: { increment: 1 } } });
      results.push({ id: t.id, ...sent });
    } catch { results.push({ id: t.id, enviado: false }); }
  }
  return { ok: true, resultados: results };
}

export async function buffer(p: string) {
  const messages = await prisma.agentInbox.findMany({ where: {phone:p,consumedAt:null}, orderBy:[{moment:'asc'},{createdAt:'asc'}],take:100 });
  return {ok:true,messages:messages.map(m=>JSON.stringify({messageId:m.messageId,mediaKind:m.mediaKind,text:m.content||'',ready:m.ready}))};
}
export async function prepare(b: Body) {
  const p=phone(b.telefone), execution=key(b.execucao);
  await importHistory(p);
  const claim=await prisma.$transaction(async tx=>{
    await lockConversation(tx,p);
    const prior=await tx.agentEvent.findUnique({where:{key:`batch:${p}:${execution}`}});
    if (prior?.result) return prior.result;
    const c=await tx.agentConversation.findUnique({where:{phone:p}});
    if(!c || (c.pausedUntil && c.pausedUntil>new Date())) return {ok:true,processar:false};
    const messages=await tx.agentInbox.findMany({where:{phone:p,consumedAt:null},orderBy:[{moment:'asc'},{createdAt:'asc'}],take:101});
    if(!messages.length || messages.length>100 || messages.some(m=>!m.ready)) return {ok:true,processar:false};
    const result={ok:true,processar:true,geracao:c.generation,message:messages.map(m=>m.content||'').join('\n\n'),mediaIds:messages.filter(m=>['imagem','pdf'].includes(m.mediaKind)).map(m=>m.messageId),messageId:messages[messages.length-1].messageId};
    await tx.agentInbox.updateMany({where:{id:{in:messages.map(m=>m.id)}},data:{consumedAt:new Date()}});
    await tx.agentEvent.create({data:{key:`batch:${p}:${execution}`,phone:p,kind:'BATCH',payload:{},result:json(result)}});
    return result;
  });
  return {...(await context(p)),...(claim as object)};
}

export async function operate(b: Body) {
  switch (b.acao) {
    case 'entrada': return inbound(b);
    case 'buffer': return buffer(phone(b.telefone));
    case 'preparar': return prepare(b);
    case 'conteudo': {
      const p=phone(b.telefone), id=key(b.messageId), content=text(b.texto,24000);
      const result=await prisma.agentInbox.updateMany({where:{id:`in:${p}:${id}`,phone:p,consumedAt:null,ready:false},data:{content,ready:true}});
      return {ok:true,atualizado:result.count===1};
    }
    case 'contexto': return context(phone(b.telefone));
    case 'pausar': {
      const p = phone(b.telefone);
      await prisma.$transaction(async tx => { await lockConversation(tx,p); await current(tx,p,b); await tx.agentConversation.update({where:{phone:p},data:{pausedUntil:new Date(Date.now()+30*60000)}}); });
      return {ok:true,pausado:true};
    }
    case 'pedido': return saveOrder(b);
    case 'pendencia': return ticket(b);
    case 'equipe': return team(b);
    case 'lembretes': return reminders();
    case 'menu': {
      const p = phone(b.telefone);
      if (!Number.isInteger(b.geracao)) throw new AgentError('Geração obrigatória.');
      const sent = await sendOnce(`menu:${p}:${key(b.messageId)}`, p, 'Cardápio / Menú — Gula dos Meninos', undefined, Number(b.geracao), 'menu');
      return { ok: sent.enviado, ...sent };
    }
    case 'qr': {
      const p = phone(b.telefone);
      if (!Number.isInteger(b.geracao)) throw new AgentError('Geração obrigatória.');
      const order = await prisma.order.findFirst({ where: { id: text(b.pedidoId, 100), customerPhone: p, status: 'PENDENTE' } });
      if (!order) throw new AgentError('Consulte ou registre a encomenda antes de cobrar.');
      const plan = paymentPlan(Number(order.total), Number(order.paid), order.deliveryDate.toISOString().slice(0, 10), order.payFull);
      if (!plan.pagarAgora) return { ok: true, enviado: false, motivo: 'Nenhum valor pendente agora.', ...plan };
      const caption = b.idioma === 'es' ? `Pago: ${plan.pagarAgora} Bs. Envíanos el comprobante para revisión.` : `Pagamento: ${plan.pagarAgora} Bs. Envie o comprovante para conferência.`;
      const sent = await sendOnce(`qr:${p}:${key(b.messageId)}`, p, caption, undefined, Number(b.geracao), 'qr');
      return { ok: sent.enviado, ...sent, ...plan };
    }
    case 'enviar': {
      const p = phone(b.telefone), message = text(b.texto, 6000);
      if (!message || !Number.isInteger(b.geracao)) throw new AgentError('Texto e geração obrigatórios.');
      const sent = await sendOnce(`reply:${p}:${key(b.messageId)}:${key(b.parte)}`, p, message, undefined, Number(b.geracao));
      return { ok: sent.enviado, ...sent };
    }
    default: throw new AgentError('Operação desconhecida.');
  }
}
