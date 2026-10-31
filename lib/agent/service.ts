import { resolveTicketInTransaction } from './ticket-resolution';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { AgentError, dateOnly, dayLaPaz, key, orderInput, paymentPlan, phone, resolvedCommand, text, yangoUrl } from './rules';
import { lockConversation, sendOnce } from './transport';
import { importHistory } from './history';
import { linkLegacyOrders } from './identity';
import { recordReceiptPayment } from './payments';
import { unsettledReceiptMedia } from './receipt-carry';
import { quotedPriceIssues, filterAvailableProductLists } from './quoted-prices';
import { receiptReview, receiptNotice, closeMessage, deliveryFee } from './review';
import { pendingNotice, compatibleReceipt } from './notices';
import { conversationFacts, currentReminderDetails, recoveredText } from './conversation-context';
import { lookupYangoFee } from './yango';
import { catalogForPrompt } from './catalog-context';
import { promotionAvailable } from './promotions';

type Body = Record<string, unknown>;
const moneyValue=(v:unknown)=>typeof v==='number'?Math.round(v*100)/100:NaN;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const destination=(b:Body)=>b.destinoTeste==='59175678921' && b.telefone==='59175678921' && (text(b.cliente).startsWith('[TESTE]') || text((b.pedido as Body)?.cliente).startsWith('[TESTE]'))?'59175678921':group();
const group = () => { const g = process.env.WHATSAPP_EQUIPE; if (!g) throw new AgentError('Grupo da equipe não configurado.', 503); return g; };
function presentOrder(o: { id: string; number: number; customerName: string; product: string; total: unknown; paid: unknown; deliveryDate: Date; payFull: boolean; deliveryLink?:string|null; deliveryLinkSentAt?:Date|null; dispatchedAt?:Date|null; [k: string]: unknown }) {
  return { id: o.id, numero: o.number, cliente: o.customerName, produto: o.product, itens: o.agentItems, data: o.deliveryDate.toISOString().slice(0, 10), horario: o.deliveryTime, modalidade: o.deliveryMode, endereco: o.deliveryAddress, situacao: o.status, rastreio:o.deliveryLink||null,linkEnviadoEm:o.deliveryLinkSentAt?.toISOString()||null,saiuParaEntregaEm:o.dispatchedAt?.toISOString()||null, versao: o.agentVersion, observacoes: o.notes, massa:o.dough,recheio:o.filling,cobertura:o.topping,decoracao:o.decoration, ...paymentPlan(Number(o.total), Number(o.paid), o.deliveryDate.toISOString().slice(0, 10), o.payFull) };
}
export async function catalog() {
 const products=await prisma.product.findMany({where:{active:true,onStore:true},include:{variants:{where:{active:true}}}});
 return products.filter(p=>promotionAvailable(p.name)).flatMap(p=>p.variants.map(v=>({variantId:v.id,produto:p.name,tamanho:v.name,descricao:p.description,preco:Number(v.price),estoque:v.stock,controlaEstoque:p.trackStock,precoSobConsulta:p.priceOnRequest})));
}
export async function context(p: string) {
  await linkLegacyOrders(p);
  const [orders, tickets, conversation, inbox, sent, events, imported, recovered] = await Promise.all([
    prisma.order.findMany({ where: { customerPhone: p }, orderBy: [{ deliveryDate: 'desc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.agentTicket.findMany({ where: { phone: p }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.agentConversation.findUnique({ where: { phone: p } }),
    prisma.agentInbox.findMany({ where:{phone:p,ready:true},orderBy:{moment:'desc'},take:80 }),
    prisma.agentDelivery.findMany({ where:{phone:p,status:'SENT'},orderBy:{createdAt:'desc'},take:80 }),
    prisma.agentEvent.findMany({ where:{phone:p,kind:{in:['HISTORY','INBOUND']}},orderBy:{createdAt:'desc'},take:100 }),
    prisma.agentEvent.findUnique({where:{key:`history-v2:${p}`}}),
    prisma.agentEvent.findUnique({where:{key:`history-n8n:${p}`}}),
  ]);
  const liveIds=new Set([...inbox.map(m=>m.messageId),...sent.map(m=>m.messageId).filter(Boolean),...events.filter(m=>m.kind==='INBOUND').map(m=>m.key.slice(`in:${p}:`.length))]);
  const history=[...inbox.map(m=>({papel:'cliente',origem:'cliente',texto:recoveredText(m.content,(events.find(e=>e.key===`in:${p}:${m.messageId}`)?.payload as Body)?.text),data:new Date(Number(m.moment)).toISOString()})),...sent.map(m=>({papel:'atendente',origem:'agente',texto:(m.body as Body).message,data:m.createdAt.toISOString()})),...events.filter(m=>{const v=m.payload as Body;return (m.kind==='HISTORY'&&!liveIds.has(String(v.messageId))) || (m.kind==='INBOUND'&&v.fromMe===true);}).map(m=>({papel:(m.payload as Body).fromMe?'atendente':'cliente',origem:m.kind==='INBOUND'?'humano':(m.payload as Body).fromApi===true?'agente':'historico_anterior',texto:(m.payload as Body).text,data:m.kind==='INBOUND'&&Number((m.payload as Body).moment)>0?new Date(Number((m.payload as Body).moment)).toISOString():m.createdAt.toISOString()}))].sort((a,b)=>a.data.localeCompare(b.data)).slice(-100);
  const failures=inbox.filter(m=>/não pôde ser analisada|Falha anterior de análise/i.test(m.content||'')).map(m=>{const raw=events.find(e=>e.key===`in:${p}:${m.messageId}`)?.payload as Body|undefined;return {data:new Date(Number(m.moment)).toISOString(),tipo:raw?.media||m.mediaKind,textoOriginal:raw?.text||null,textoRecuperado:recoveredText(m.content,raw?.text)!==m.content};});
  return { ok: true, catalogo:await catalog(), historico:history, contextoConversa:{...conversationFacts(history),marcadoresAnteriores:failures}, historicoWhatsappImportado:!!imported||!!recovered,historicoRecuperadoN8n:!!recovered,historicoParcial:true, hoje: dayLaPaz(), pedidos: orders.map(presentOrder), pendencias: tickets, geracao: conversation?.generation ?? 0, pausado: !!(conversation?.pausedUntil && conversation.pausedUntil > new Date()), limiteConsulta: 100 };
}
async function current(tx: Prisma.TransactionClient, p: string, b: Body) {
  const c = await tx.agentConversation.findUnique({ where: { phone: p } });
  if (!c || !Number.isInteger(b.geracao) || c.generation !== b.geracao || (c.pausedUntil && c.pausedUntil > new Date())) throw new AgentError('Nova mensagem ou atendimento humano: reavaliar antes de agir.', 409);
}
export async function inbound(b: Body) {
  const p = phone(b.telefone), id = key(b.messageId);
  const n = Number(b.momento);
  const sourceUrl=text(b.midiaUrl,3000);
  if(sourceUrl && !/^https:\/\//i.test(sourceUrl)) throw new AgentError('URL de mídia inválida.');
  const moment = Number.isFinite(n) && n > 0 ? Math.round(n < 1e12 ? n * 1000 : n) : Date.now();
  if (moment > Date.now() + 300000) throw new AgentError('Data da mensagem inválida.');
  const duplicate = await prisma.$transaction(async tx => {
    await lockConversation(tx, p);
    const eventKey = `in:${p}:${id}`;
    const previous = await tx.agentEvent.findUnique({ where: { key: eventKey } });
    if (previous) {
      if (b.recuperarPendente === true && b.humano !== true) {
        const pending=await tx.agentInbox.findUnique({where:{id:eventKey}});
        const conversation=await tx.agentConversation.findUnique({where:{phone:p}});
        // Resume only an unprocessed current input after a lost HTTP response. Never advance generation twice.
        const registeredGeneration=(previous.payload as Body)?.generation;
        const isCurrent=registeredGeneration===undefined ? conversation?.latestMoment===BigInt(moment) : conversation?.generation===registeredGeneration;
        if(pending && !pending.ready && !pending.consumedAt && conversation && isCurrent &&
          !(conversation.pausedUntil && conversation.pausedUntil>new Date())) return false;
      }
      return true;
    }
    const c = await tx.agentConversation.findUnique({ where: { phone: p } });
    await tx.agentEvent.create({ data: { key: eventKey, phone: p, kind: 'INBOUND', payload: json({ sourceUrl, generation:(c?.generation ?? 0)+1, quoted:text(b.citacao,4000), text: text(b.texto, 12000)+(text(b.citacao,4000)?'\n[Mensagem citada: '+text(b.citacao,4000)+']':''), media: ['imagem', 'pdf', 'localizacao', 'texto', 'audio'].includes(String(b.midia)) ? b.midia : 'outro', fromMe: b.humano === true, moment, ...(b.anuncio && typeof b.anuncio === 'object' ? { anuncio: { id: text((b.anuncio as Body).id, 60), tipo: text((b.anuncio as Body).tipo, 30), titulo: text((b.anuncio as Body).titulo, 120) } } : {}) }) } });
    // A new client ID is new input, even when webhooks arrive out of order.
    // Old human callbacks still must not take over a newer conversation.
    if (b.humano === true && c && BigInt(moment) < c.latestMoment) return true;
    if (b.humano === true) await tx.agentTicket.updateMany({ where: { phone: p, status: 'ABERTA' }, data: { status: 'ASSUMIDA' } });
    if (b.humano !== true) await tx.agentInbox.create({ data: { id:eventKey, phone:p, messageId:id, mediaKind:String(b.midia || 'outro'), moment:BigInt(moment) } });
    const latestMoment=c && c.latestMoment>BigInt(moment) ? c.latestMoment : BigInt(moment);
    await tx.agentConversation.upsert({ where: { phone: p }, create: { phone: p, generation: 1, latestMoment, pausedUntil: b.humano === true ? new Date(Date.now() + 30 * 60000) : null }, update: { generation: { increment: 1 }, latestMoment, ...(b.humano === true ? { pausedUntil: new Date(Date.now() + 30 * 60000) } : {}) } });
    return false;
  });
  return { ...(await context(p)), ignorar: duplicate };
}
export async function saveOrder(b: Body) {
  const p = phone(b.telefone), source = key(b.messageId), input = b.pedido;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AgentError('Pedido inválido.');
  let raw = input as Body;
  const orderId = text(raw.id, 100), name = text(raw.cliente, 120);
  if (!name) throw new AgentError('Nome do cliente obrigatório.');
  // Alteração só de data/horário/entrega/endereço de pedido existente: itens podem vir vazios e são mantidos
  // (inclui pedidos criados pela equipe no painel, com produto em texto livre e preço combinado).
  const keepItems = !!orderId && (!Array.isArray(raw.itens) || !raw.itens.length);
  if (text(raw.modalidade,20)==='ENTREGA' && !text(raw.endereco,1000) && !keepItems) return {ok:false,registrado:false,motivo:'ENDERECO_OBRIGATORIO',orientacao:'Peça ao cliente o endereço ou a localização da entrega. Não registre nem envie QR até receber esse dado; não é necessário abrir pendência para a equipe.'};
  if (!keepItems && (!Array.isArray(raw.itens) || !raw.itens.length)) throw new AgentError('Informe os itens da encomenda.');
  const prices=await catalog();
  const eventKey = `order:${p}:${source}`;
  const result = await prisma.$transaction(async tx => {
    await lockConversation(tx, p);
    const old = await tx.agentEvent.findUnique({ where: { key: eventKey } });
    if (old?.result) return old.result;
    await current(tx, p, b);
    const existing = orderId ? await tx.order.findFirst({ where: { id: orderId, customerPhone: p, status: 'PENDENTE' } }) : null;
    if (orderId && !existing) throw new AgentError('Encomenda deste cliente não encontrada ou encerrada.', 404);
    if (keepItems && existing) {
      // Campos não enviados ficam como estão na ficha; itens, produto e valor nunca mudam neste modo.
      raw = { ...raw,
        itens: [{ descricao: existing.product.split('\n')[0].slice(0, 300) || 'Encomenda', quantidade: 1, precoUnitario: Number(existing.total) }],
        modalidade: text(raw.modalidade, 20) || existing.deliveryMode || '',
        endereco: text(raw.endereco, 1000) || existing.deliveryAddress || '',
        data: raw.data || existing.deliveryDate.toISOString().slice(0, 10),
        horario: raw.horario ?? existing.deliveryTime ?? '' };
      if (text(raw.modalidade,20)==='ENTREGA' && !text(raw.endereco,1000)) return {ok:false,registrado:false,motivo:'ENDERECO_OBRIGATORIO',orientacao:'Peça ao cliente o endereço ou a localização da entrega antes de alterar o pedido.'};
    }
    const data = orderInput(raw, new Date(), existing || undefined);
    if (keepItems && existing) {
      data.product = existing.product; data.total = Number(existing.total);
      data.agentItems = (existing.agentItems ?? null) as unknown as typeof data.agentItems;
      data.payFull = existing.payFull || raw.pagarIntegral === true;
      if (!text(raw.massa, 200)) data.dough = existing.dough;
      if (!text(raw.recheio, 300)) data.filling = existing.filling;
      if (!text(raw.cobertura, 300)) data.topping = existing.topping;
      if (!text(raw.decoracao, 1000)) data.decoration = existing.decoration;
      data.notes = text(raw.observacoes, 2000) ? [existing.notes, text(raw.observacoes, 2000)].filter(Boolean).join('\n') : existing.notes;
    }
    // A repeated save of the exact persisted order is a read, not another update.
    // Receipt processing must not invalidate a valid payment because the model repeated stale SKU ids.
    const unchanged=existing && Number(raw.versao)===existing.agentVersion && name===existing.customerName && Object.entries(data).every(([field,value])=>{
      const previous=(existing as unknown as Body)[field];
      if(field==='total')return Number(previous)===Number(value);
      if(value instanceof Date)return previous instanceof Date&&previous.getTime()===value.getTime();
      if(value===null||value===undefined)return previous===null||previous===undefined;
      // SKU repetido/desatualizado não conta como alteração: compara os itens sem o variantId.
      if(field==='agentItems'){const strip=(v:unknown)=>JSON.stringify(Array.isArray(v)?v.map(i=>{const {variantId:_v,...rest}=(i||{}) as Body;return rest;}):v);return strip(previous)===strip(value);}
      if(typeof value==='object')return JSON.stringify(previous)===JSON.stringify(value);
      return previous===value;
    });
    if(unchanged) return {ok:true,registrado:true,semAlteracao:true,pedido:presentOrder(existing),pagamentoConfirmado:false};
    // Venda conduzida pela equipe (mensagem humana recente na conversa): o estoque do painel não bloqueia o registro,
    // porque a equipe já aceitou e muitas vezes já recebeu o pagamento. Fica o aviso nas observações.
    const stockWarnings:string[]=[];
    let teamSale:boolean|undefined;
    if (!keepItems) for (const line of raw.itens as Body[]) {
    const variant=prices.find(v=>v.variantId===line.variantId);
    if(!variant || variant.precoSobConsulta) throw new AgentError('Item sem preço autorizado no catálogo atual. Consulte consultar_cardapio para obter o variantId exato; não invente SKU nem repita a tentativa com o mesmo ID. Se for preço sob consulta, encaminhe orçamento à equipe.');
    if(moneyValue(line.precoUnitario)!==variant.preco) throw new AgentError(`Preço mudou no painel: ${variant.produto} ${variant.tamanho} custa ${variant.preco} Bs. Confirme o novo resumo com o cliente antes de registrar.`);
    const sameSku=(raw.itens as Body[]).filter(i=>i.variantId===line.variantId).reduce((sum,i)=>sum+Number(i.quantidade),0);
    if(!existing && variant.controlaEstoque && sameSku>variant.estoque){
      if(teamSale===undefined)teamSale=!!(await tx.agentEvent.findFirst({where:{phone:p,kind:'INBOUND',createdAt:{gte:new Date(Date.now()-36*3600000)},payload:{path:['fromMe'],equals:true}},select:{key:true}}));
      if(!teamSale)throw new AgentError(`Estoque insuficiente no painel: ${variant.produto}, disponível ${variant.estoque}; solicitado ${sameSku}. Não registrar nem cobrar; consulte alternativas ou equipe.`);
      const warning=`⚠️ Venda da equipe acima do estoque do painel: ${variant.produto} (disponível ${variant.estoque}, vendido ${sameSku}).`;
      if(!stockWarnings.includes(warning))stockWarnings.push(warning);
    }
    }
    if(stockWarnings.length)data.notes=[data.notes,...stockWarnings].filter(Boolean).join('\n');
    let order;
    if (orderId) {
      if (!existing) throw new AgentError('Encomenda deste cliente não encontrada ou encerrada.', 404);
      if (data.total < Number(existing.paid)) throw new AgentError('Total menor que o pagamento confirmado; equipe deve ajustar.', 409);
      const result = await tx.order.updateMany({ where: { id: orderId, customerPhone: p, status: 'PENDENTE', agentVersion: Number(raw.versao) }, data: { ...data, customerName: name, agentVersion: { increment: 1 } } });
      if (!result.count) throw new AgentError('Pedido foi alterado; consulte novamente.', 409);
      order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    } else {
      // Retries e novo texto de confirmação não recriam o mesmo pedido pendente.
      order = raw.novoPedidoSeparado === true ? null : await tx.order.findFirst({ where: { customerPhone: p, status: 'PENDENTE', product: data.product, deliveryDate: data.deliveryDate, total: data.total } });
      if (!order) order = await tx.order.create({ data: { ...data, customerName: name, customerPhone: p, agentRef: eventKey, channel: 'WHATSAPP', paid: 0 } });
    }
    const result = { ok: true, registrado: true, pedido: presentOrder(order), pagamentoConfirmado: false };
    await tx.agentEvent.create({ data: { key: eventKey, phone: p, kind: 'ORDER', payload: json(raw), result: json(result) } });
    return result;
  });
  const saved = result as unknown as {ok:boolean;registrado:boolean;pedido:{id:string;numero:number;produto:string;data:string;horario:string|null;total:number;pagarAgora:number;versao:number}};
  // O painel recebe a encomenda imediatamente; o grupo recebe só o comprovante.
  // Dúvidas/orçamentos seguem pela ferramenta de pendência quando exigem equipe.
  return {...saved,notificacaoEnviada:false,notificacaoPrevista:'APOS_COMPROVANTE'};

}
export async function ticket(b: Body) {
  const p = phone(b.telefone), id = key(b.messageId), question = text(b.pergunta, 4000), kind = b.tipo === 'COMPROVANTE' ? 'COMPROVANTE' : 'DUVIDA';
  if (!question) throw new AgentError('Informe a dúvida ou os dados do comprovante.');
  let receiptMedia: Array<{id:string;url:string;kind:string}>=[];
  let report=question;
  let receiptKey:string|null=null;
  let linkedOrderId:string|null=null;
  const t = await prisma.$transaction(async tx => {
    await lockConversation(tx, p);
    await current(tx, p, b);
    if (kind === 'COMPROVANTE') {
      const ids = Array.isArray(b.mediaIds) ? b.mediaIds.slice(0, 20).map(key) : [];
      if (!ids.length) throw new AgentError('Sem imagem/PDF recebido neste lote.');
      receiptKey=`ticket:${p}:COMPROVANTE:${[...new Set(ids)].sort().join('|')}`;
      const priorReceipt=await tx.agentTicket.findUnique({where:{sourceKey:receiptKey}});
      const media = await tx.agentEvent.findMany({ where: { key: { in: ids.map(m => `in:${p}:${m}`) }, phone: p, kind: 'INBOUND' } });
      const recent = media.some(m => { const payload = m.payload as Body; return ['imagem', 'pdf'].includes(String(payload.media)) && payload.fromMe === false && m.createdAt.getTime() > Date.now() - 10 * 60000; });
      if (!recent) throw new AgentError('Localização, texto ou mídia antiga não é comprovante atual.');
      receiptMedia=media.filter(m=>{const v=m.payload as Body;return ['imagem','pdf'].includes(String(v.media))&&v.fromMe===false&&m.createdAt.getTime()>Date.now()-10*60000;}).map(m=>({id:m.key,url:text((m.payload as Body).sourceUrl,3000),kind:String((m.payload as Body).media)})).filter(m=>m.url);
      if(priorReceipt) return priorReceipt;
      const analyzed=await tx.agentInbox.findMany({where:{phone:p,messageId:{in:ids},ready:true}});
      // A batch may carry a real receipt plus another picture (e.g. the customer's own sum). Keep only receipt media;
      // reject only when every analyzed medium is something else.
      const notReceipt=new Set(analyzed.filter(m=>/Tipo\s*:\s*(OUTRA_IMAGEM|REFERENCIA_BOLO)|[\"']tipo[\"']\s*:\s*[\"'](OUTRA_IMAGEM|REFERENCIA_BOLO)/i.test(m.content||'')).map(m=>m.messageId));
      if(notReceipt.size&&ids.every(id=>notReceipt.has(id))) throw new AgentError('Analisador identificou mídia que não é comprovante: não confirmar recebimento de pagamento.');
      if(notReceipt.size) receiptMedia=receiptMedia.filter(m=>!notReceipt.has(m.id.slice(`in:${p}:`.length)));
      const receipt=b.comprovante;
      if(!receipt || typeof receipt!=='object' || (receipt as Body).tipo!=='COMPROVANTE_BANCARIO') throw new AgentError('Classifique a mídia atual e informe campos visíveis do comprovante.');
      const orderId=text((receipt as Body).pedidoId,100);
      const order=orderId?await tx.order.findFirst({where:{id:orderId,customerPhone:p}}):null;
      linkedOrderId=order?.id||null;
      const expected=order?paymentPlan(Number(order.total),Number(order.paid),order.deliveryDate.toISOString().slice(0,10),order.payFull).pagarAgora:null;
      const balance=order?Math.max(0,Math.round((Number(order.total)-Number(order.paid))*100)/100):null;
      const review=receiptReview(receipt as Body,expected,dayLaPaz(),balance);
      report=receiptNotice(receipt as Body,order?presentOrder(order):null,review);
      // Missing registration must not erase the commercial context sent with the receipt.
      // This text is for human review only and never participates in payment matching.
      const requestContext=text(b.pergunta,2000);
      // Without a registered order, skip the empty "não identificado" sections and the agent's own copies
      // of the receipt fields; receipt values always come from the structured data, never from prose.
      if(!order) report=receiptNoticeWithoutOrder(receipt as Body,review,requestContext);
      if(order && review.alertas.length===0 && review.valorVisivel!==null) {
        const ownMedia=media.find(m=>{const v=m.payload as Body;return ['imagem','pdf'].includes(String(v.media))&&v.fromMe===false&&m.createdAt.getTime()>Date.now()-10*60000;});
        if(!ownMedia)throw new AgentError('Comprovante sem mídia vinculada ao cliente.');
        const mediaId=ownMedia.key.slice(`in:${p}:`.length);
        await recordReceiptPayment(tx,order.id,p,mediaId,review.valorVisivel);
      }
    }
    const sourceKey = receiptKey || `ticket:${p}:${kind}:${id}`;
    return tx.agentTicket.upsert({ where: { sourceKey }, create: { sourceKey, orderId:linkedOrderId, phone: p, customerName: text(b.cliente, 120) || p, question:report, kind, nextReminderAt: new Date(Date.now() + 10 * 60000) }, update: {} });
  });
  let sent: { enviado: boolean; estado: string; messageId: string | null };
  try { sent = await sendOnce(`ticket:${t.id}`, destination(b), pendingNotice(t.kind,t.customerName,t.phone,t.question), t.id); }
  catch { sent = { enviado: false, estado: 'NAO_CONFIGURADO', messageId: null }; }
  let mediaSent=kind!=='COMPROVANTE'||receiptMedia.length>0;
  for(const m of receiptMedia) { try {const r=await sendOnce(`receipt:${t.id}:${m.id}`,destination(b),'📎 Comprovante original — '+t.customerName,t.id,undefined,m.kind==='pdf'?'receipt-pdf':'receipt-image',m.url);mediaSent=mediaSent&&r.enviado;} catch {mediaSent=false;} }
  return { midiaEnviada:mediaSent, ok: true, registrado: true, ticketId: t.id, tipo: t.kind, notificacaoEnviada: sent.enviado, estadoEnvio: sent.estado, messageId: sent.messageId };
}
export async function resolveTicket(id: string, answer: string, who: string) {
  return prisma.$transaction(tx => resolveTicketInTransaction(tx,id,answer,who));
}

export async function team(b: Body) {
  if (String(b.grupo) !== group()) throw new AgentError('Grupo não autorizado.', 403);
  if (b.fromApi === true) return { ok: true, ignorar: true, motivo: 'MENSAGEM_AUTOMATICA' };
  const ref = key(b.referenceMessageId), id = key(b.messageId), message = text(b.texto, 3000);
  let delivery = await prisma.agentDelivery.findUnique({ where: { messageId: ref } });
  // Staff can reply to another staff response in the same linked notice thread.
  if (!delivery?.ticketId) {
    const parent=await prisma.agentEvent.findUnique({where:{key:`team-claim:${ref}`}});
    const ticketId=text((parent?.payload as Body|undefined)?.ticketId,100);
    if(ticketId) delivery={ticketId} as typeof delivery;
  }
  // Legacy reference comes only from the authenticated n8n Redis lookup.
  if(!delivery && text(b.legadoTelefone)) {
    const legacyPhone=phone(b.legadoTelefone);
    const ticket=await prisma.agentTicket.upsert({where:{sourceKey:`legacy:${ref}`},create:{sourceKey:`legacy:${ref}`,phone:legacyPhone,customerName:legacyPhone,kind:'DUVIDA',question:'Aviso anterior à migração, vinculado pela referência Redis.',nextReminderAt:new Date(Date.now()+10*60000)},update:{}});
    delivery=await prisma.agentDelivery.upsert({where:{key:`legacy:${ref}`},create:{key:`legacy:${ref}`,phone:group(),ticketId:ticket.id,messageId:ref,status:'SENT',body:{message:'Aviso anterior à migração'}},update:{}});
  }
  if (!delivery?.ticketId) {
    if (!resolvedCommand(message) && !/yango|preparando/i.test(message)) return { ok: true, ignorar: true, motivo: 'AVISO_NAO_VINCULADO' };
    throw new AgentError('Responda a um aviso do agente vinculado ao cliente.', 404);
  }
  const t = await prisma.agentTicket.findUniqueOrThrow({ where: { id: delivery.ticketId } });
  if (resolvedCommand(message)) return resolveTicket(t.id, '', 'grupo');
  if(t.kind==='DUVIDA' && /yango|entrega|env[ií]o/i.test(t.question) && !/[?¿]/.test(message) && /^(?:sim[,!\s]+)?(?:j[aá]\s+)?foi\s+(?:enviado|entregue)(?:\b|[.!\s])/i.test(message)) return resolveTicket(t.id,message,'grupo');
  if(/^(preparando|pedido confirmado[,; ]+preparando|pagamento confirmado[,; ]+preparando|pago confirmado[,; ]+preparando)[.!\s]*$/i.test(message)) {
    const ctx=await context(t.phone);const es=ctx.historico.filter(m=>m.papel==='cliente').slice(-20).some(m=>/\b(hola|quiero|gracias|mañana)\b/i.test(String(m.texto)));
    const sent=await sendOnce(`preparing:${t.id}`,t.phone,es?'¡El equipo confirmó tu pedido y ya está preparándolo! 💛🧁':'A equipe confirmou seu pedido e já está preparando! 💛🧁',t.id);
    let retomado=false;
    if(sent.enviado) {retomado=(await resolveTicket(t.id,'Equipe confirmou início do preparo.','grupo')).retomado;await prisma.agentEvent.upsert({where:{key:`preparing:${t.id}`},create:{key:`preparing:${t.id}`,phone:t.phone,kind:'PREPARING',payload:{confirmadoPelaEquipe:true},result:{enviado:true}},update:{}});}
    return {ok:sent.enviado,preparoConfirmado:sent.enviado,retomado,telefone:t.phone,...sent};
  }
  if (!/https:\/\/(?:[a-z0-9-]+\.)*yango\.com(?:[/:?#]|$)/i.test(message) && !/^\s*yango\b/i.test(message)) {
    if (!message) return { ok: true, ignorar: true };
    return prisma.$transaction(async tx => {
      await lockConversation(tx, group());
      await lockConversation(tx, t.phone);
      const eventKey = `team-claim:${id}`;
      if (await tx.agentEvent.findUnique({ where: { key: eventKey } })) return { ok: true, assumido: true, ignorar: true };
      const changed = await tx.agentTicket.updateMany({ where: { id: t.id, status: { in: ['ABERTA', 'ASSUMIDA'] } }, data: { status: 'ASSUMIDA', answer: message } });
      if (!changed.count) return { ok: true, ignorar: true, motivo: 'AVISO_JA_RESOLVIDO' };
      await tx.agentConversation.updateMany({ where: { phone: t.phone }, data: { pausedUntil: new Date(Date.now() + 30 * 60000), generation: { increment: 1 } } });
      await tx.agentEvent.create({ data: { key: eventKey, phone: t.phone, kind: 'TEAM_TAKEOVER', payload: { ticketId: t.id, message } } });
      return { ok: true, assumido: true, lembretesSuspensos: true };
    });
  }
  return sendYangoLink({ticketId:t.id,link:message.match(/https:\/\/\S+/)?.[0],fee:deliveryFee(message),source:'grupo'});

}

/** Resolve old receipt notices through the persisted receipt/payment event, never by customer name or amount. */
export async function deliveryOrderForTicket(t:{id:string;phone:string;sourceKey:string;orderId?:string|null}) {
 let id=t.orderId||'';
 if(!id && t.sourceKey.startsWith(`ticket:${t.phone}:COMPROVANTE:`)) {
  const ids=new Set<string>();
  for(const media of t.sourceKey.slice(`ticket:${t.phone}:COMPROVANTE:`.length).split('|')) {
   const event=await prisma.agentEvent.findUnique({where:{key:`receipt-payment:${t.phone}:${media}`}});
   const orderId=text((event?.payload as Body|undefined)?.orderId,100);if(orderId)ids.add(orderId);
  }
  if(ids.size===1)id=[...ids][0];
 }
 return id?prisma.order.findFirst({where:{id,customerPhone:t.phone}}):null;
}

export async function sendYangoLink(input:{orderId?:string;ticketId?:string;link:unknown;fee?:number|null;source:'painel'|'grupo'}) {
 const requestedLink=yangoUrl(input.link);
 if(input.fee!==undefined&&input.fee!==null&&(!Number.isFinite(input.fee)||input.fee<0||input.fee>10000))throw new AgentError('Valor da entrega inválido.');
 const t=input.ticketId?await prisma.agentTicket.findUnique({where:{id:input.ticketId}}):null;
 if(input.ticketId&&!t)throw new AgentError('Pendência não encontrada.',404);
 const order=input.orderId?await prisma.order.findUnique({where:{id:input.orderId}}):t?await deliveryOrderForTicket(t):null;
 if(input.source==='painel'&&!order)throw new AgentError('Abra a ficha do pedido para enviar: esta pendência ainda não tem pedido vinculado.');
 if(order && (order.status==='CANCELADA'||order.deliveryMode!=='ENTREGA'||Number(order.paid)<=0))throw new AgentError('O pedido precisa ser de entrega e ter pagamento confirmado.');
 if(order&&t&&order.customerPhone!==t.phone)throw new AgentError('Pendência e pedido são de clientes diferentes.');
 if(order&&t){const linked=await deliveryOrderForTicket(t);if(linked&&linked.id!==order.id)throw new AgentError('A pendência pertence a outro pedido.');}
 const p=phone(order?.customerPhone||t?.phone);
 const scope=order?`order:${order.id}`:`ticket:${t!.id}`;
 const planKey=`yango-plan:${scope}`;
 const previous=await prisma.agentEvent.findUnique({where:{key:planKey}});
 if(order?.deliveryLinkSentAt) {
  const result=previous?.result as Body|undefined;
  const resolved=t&&t.status!=='RESOLVIDA'?await resolveTicket(t.id,`Link Yango já enviado: ${order.deliveryLink}`,input.source):null;
  return {ok:true,enviado:true,jaEnviado:true,telefone:p,orderId:order.id,link:order.deliveryLink,sentAt:order.deliveryLinkSentAt.toISOString(),resumeTicketId:t?.id||text(result?.resumeTicketId,100)||undefined,retomado:resolved?.retomado||false};
 }
 let plan=previous?.payload as Body|undefined;
 if(!plan) {
  const old=await prisma.agentDelivery.findMany({where:{phone:p,status:'SENT',key:{startsWith:'yango:'}},orderBy:{createdAt:'asc'},take:100});
  const related=order?await prisma.agentTicket.findMany({where:{phone:p,orderId:order.id}}):[];
  const relatedIds=new Set([...related.map(x=>x.id),...(t?[t.id]:[])]);
  const legacy=old.find(d=>d.ticketId&&relatedIds.has(d.ticketId));
  const oldLink=legacy?String((legacy.body as Body).message||'').match(/https:\/\/[^\s]+/)?.[0]:undefined;
  const link=oldLink?yangoUrl(oldLink):requestedLink;
  const fetchedFee=await lookupYangoFee(link);const fee=fetchedFee??input.fee??null;
  const ctx=await context(p);const messages=ctx.historico.filter(m=>m.papel==='cliente').slice(-20).reverse();
  const detected=messages.find(m=>/\b(hola|quiero|gracias|buenas|mañana|puedes|quero|obrigad[oa]|amanhã|você)\b|[ãõ]/i.test(String(m.texto)));
  const lang=/\b(hola|quiero|gracias|buenas|mañana|puedes)\b/i.test(String(detected?.texto||''))?'es':'pt';
  plan=await prisma.$transaction(async tx=>{
   await lockConversation(tx,p);const existing=await tx.agentEvent.findUnique({where:{key:planKey}});if(existing)return existing.payload as Body;
   const payload={link,fee,lang,source:input.source,customerKey:legacy?.key||`yango-${scope}`,orderId:order?.id||null,ticketId:t?.id||null,fonteValor:fetchedFee!==null?'YANGO':input.fee!==undefined&&input.fee!==null?'EQUIPE':'NAO_DISPONIVEL'};
   await tx.agentEvent.create({data:{key:planKey,phone:p,kind:'YANGO_PLAN',payload}});return payload;
  });
 }
 const link=String(plan.link),fee=typeof plan.fee==='number'?plan.fee:null;
 const sent=await sendOnce(String(plan.customerKey),p,closeMessage(plan.lang==='es'?'es':'pt',link,fee),t?.id);
 if(!sent.enviado)return {ok:false,telefone:p,...sent,error:'Envio não confirmado. Confira o WhatsApp antes de tentar novamente.'};
 const delivery=await prisma.agentDelivery.findUnique({where:{key:String(plan.customerKey)}});
 const sentAt=delivery?.updatedAt||new Date();
 const finalized=await prisma.$transaction(async tx=>{
  await lockConversation(tx,p);
  let anchorId=t?.id;
  if(order) {
   const actual=await tx.order.findUniqueOrThrow({where:{id:order.id}});
   if(!actual.deliveryLinkSentAt) {
    await tx.order.update({where:{id:order.id},data:{deliveryLink:link,deliveryLinkSentAt:sentAt,dispatchedAt:sentAt}});
    await tx.orderActivity.create({data:{orderId:order.id,actorName:input.source==='painel'?'Painel':'Equipe no grupo',action:`Saiu para entrega. Link da Yango enviado: ${link}. Frete separado do pagamento do pedido.`}});
   }
   const anchor=await tx.agentTicket.upsert({where:{sourceKey:`yango-dispatch:${order.id}`},create:{sourceKey:`yango-dispatch:${order.id}`,orderId:order.id,phone:p,customerName:order.customerName,kind:'ENTREGA',question:`Rastreio da entrega do pedido #${order.number}.`,nextReminderAt:new Date()},update:{}});
   anchorId=anchor.id;
   if(t)await tx.agentTicket.update({where:{id:t.id},data:{orderId:order.id}});
   const receipts=await tx.agentTicket.findMany({where:{phone:p,orderId:order.id,status:{in:['ABERTA','ASSUMIDA']}}});
   for(const receipt of receipts)if(compatibleReceipt(receipt.kind,receipt.question)||receipt.id===t?.id)await resolveTicketInTransaction(tx,receipt.id,`Link Yango enviado: ${link}`,input.source);
  }
  const resolved=anchorId?await resolveTicketInTransaction(tx,anchorId,`Link Yango enviado: ${link}${fee!==null?`; entrega: ${fee} Bs`:''}`,input.source):null;
  const result={enviado:true,orderId:order?.id||null,resumeTicketId:anchorId||null,sentAt:sentAt.toISOString()};
  await tx.agentEvent.update({where:{key:planKey},data:{result}});
  await tx.agentEvent.upsert({where:{key:`yango-sent:${scope}`},create:{key:`yango-sent:${scope}`,phone:p,kind:'DELIVERY_LINK',payload:{link,orderId:order?.id||null,valorEntrega:fee,moeda:'Bs',fonteValor:String(plan!.fonteValor)},result},update:{}});
  return {resumeTicketId:anchorId,retomado:resolved?.retomado||false};
 });
 let groupNoticeSent:boolean|undefined;
 if(plan.source==='painel') {try{const notice=await sendOnce(`yango-panel-notice:${scope}`,group(),`Link da Yango enviado para ${order?.customerName||t?.customerName||p} pelo painel.`,finalized.resumeTicketId);groupNoticeSent=notice.enviado;}catch{groupNoticeSent=false;}}
 return {ok:true,enviado:true,telefone:p,orderId:order?.id,link,sentAt:sentAt.toISOString(),encerrado:true,...finalized,groupNoticeSent};
}

export async function reminders(testTarget?: string) {
  const due = await prisma.agentTicket.findMany({ where: { ...(testTarget==='59175678921'?{phone:testTarget,customerName:{startsWith:'[TESTE]'}}:{}), status: 'ABERTA', kind: { in: ['DUVIDA','COMPROVANTE'] }, NOT: { kind: 'COMPROVANTE', question: { startsWith: '📌 *Resumo*\n✅ CONFERE:' } }, reminderCount: { lt: 3 }, nextReminderAt: { lte: new Date() } }, take: 30 });
  const results = [];
  for (const t of due) {
    if (compatibleReceipt(t.kind,t.question)) continue;
    const claim = await prisma.agentTicket.updateMany({ where: { id: t.id, status: 'ABERTA', reminderCount: t.reminderCount, nextReminderAt: t.nextReminderAt }, data: { nextReminderAt: new Date(Date.now() + 10 * 60000) } });
    if (!claim.count) continue;
    const latest = await prisma.agentTicket.findUniqueOrThrow({ where: { id: t.id } });
    if (latest.status !== 'ABERTA') continue;
    try {
      const ctx=await context(t.phone);
      const details=t.kind==='DUVIDA'?currentReminderDetails(t.question,ctx.contextoConversa,ctx.pedidos):t.question;
      const sent = await sendOnce(`reminder:${t.id}:${t.reminderCount}`, testTarget==='59175678921'?testTarget:group(), pendingNotice(t.kind,t.customerName,t.phone,details,true), t.id);
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
  // A failed media analysis must not block all later messages forever.
  const waiting=await prisma.agentInbox.findMany({where:{phone:p,ready:false,consumedAt:null,createdAt:{lte:new Date(Date.now()-10*60000)}},take:100});
  for(const m of waiting) {
    const event=await prisma.agentEvent.findUnique({where:{key:`in:${p}:${m.messageId}`}});
    const fallback='[Falha anterior de análise: conteúdo indisponível. Não inventar conteúdo nem criar nova dúvida apenas por este marcador. Usar conversa e pedido atuais; pedir reenvio somente se indispensável à solicitação atual.]';
    // Text stopped by human pause is readable; an image caption is not an image analysis.
    const content=m.mediaKind==='texto'?recoveredText(fallback,(event?.payload as Body|undefined)?.text):fallback;
    await prisma.agentInbox.updateMany({where:{id:m.id,ready:false,consumedAt:null},data:{ready:true,content:String(content)}});
  }
  const claim=await prisma.$transaction(async tx=>{
    await lockConversation(tx,p);
    const prior=await tx.agentEvent.findUnique({where:{key:`batch:${p}:${execution}`}});
    if (prior?.result) return prior.result;
    const c=await tx.agentConversation.findUnique({where:{phone:p}});
    if(!c || (c.pausedUntil && c.pausedUntil>new Date())) return {ok:true,processar:false};
    const messages=await tx.agentInbox.findMany({where:{phone:p,consumedAt:null},orderBy:[{moment:'asc'},{createdAt:'asc'}],take:101});
    if(!messages.length || messages.length>100 || messages.some(m=>!m.ready)) return {ok:true,processar:false};
    // A later text can supersede an image's generation after its batch was consumed.
    // Carry only recent, analyzed, actual receipts that have not produced a payment yet.
    const recentMedia=await tx.agentInbox.findMany({where:{phone:p,ready:true,mediaKind:{in:['imagem','pdf']},createdAt:{gte:new Date(Date.now()-10*60000)}},orderBy:{createdAt:'desc'},take:20});
    const receiptEvents=recentMedia.length?await tx.agentEvent.findMany({where:{phone:p,kind:{in:['INBOUND','RECEIPT_PAYMENT']},createdAt:{gte:new Date(Date.now()-10*60000)}}}):[];
    const carried=unsettledReceiptMedia(p,recentMedia,receiptEvents).filter(m=>!messages.some(x=>x.messageId===m.messageId));
    const mediaIds=[...new Set([...messages.filter(m=>['imagem','pdf'].includes(m.mediaKind)).map(m=>m.messageId),...carried.map(m=>m.messageId)])];
    const carriedText=carried.length?'\n\n[Comprovante real recente ainda sem registro de pagamento; mensagem posterior não substitui a mídia recebida.]\n'+carried.map(m=>m.content||'').join('\n\n'):'';
    const result={ok:true,processar:true,geracao:c.generation,message:messages.map(m=>m.content||'').join('\n\n')+carriedText,mediaIds,messageId:messages[messages.length-1].messageId};
    await tx.agentInbox.updateMany({where:{id:{in:messages.map(m=>m.id)}},data:{consumedAt:new Date()}});
    await tx.agentEvent.create({data:{key:`batch:${p}:${execution}`,phone:p,kind:'BATCH',payload:{},result:json(result)}});
    return result;
  });
  return {...(await context(p)),...(claim as object)};
}

function receiptNoticeWithoutOrder(receipt: Body, review: ReturnType<typeof receiptReview>, context: string) {
  const full=receiptNotice(receipt,null,review);
  const section=(name:string)=>full.split('\n\n').find(part=>part.includes(name))||'';
  const own=/^(📌|🧾|👉|━)|Comprovante mostra|Ação da equipe|Resumo\s*$/;
  const kept=context.split(/\n\s*\n/).map(part=>part.trim()).filter(part=>part&&!own.test(part.split('\n')[0].replace(/\*/g,'').trim())).join('\n\n');
  return [
    section('*Resumo*'),
    section('*Comprovante mostra*'),
    `📝 *O que a conversa indica* (não é pedido registrado nem confirmação de pagamento)\n${kept||'Não informado.'}`,
    '👉 *Ação da equipe*\nVincular o comprovante ao pedido certo, conferir o valor e registrar a encomenda antes de confirmar. A leitura do comprovante não confirma crédito bancário.',
  ].filter(Boolean).join('\n\n');
}

/** Called by an authenticated n8n error branch; never requires an LLM. */
export async function analysisFailure(b: Body) {
  const p=phone(b.telefone), id=key(b.messageId);
  const stage=String(b.etapa);
  if (!['imagem','pdf','audio','ia'].includes(stage)) throw new AgentError('Etapa de análise inválida.');
  const failureKey=`analysis-failure:${p}:${id}`;
  const claim=await prisma.$transaction(async tx=>{
    await lockConversation(tx,p);
    const prior=await tx.agentEvent.findUnique({where:{key:failureKey}});
    if(prior?.result) return prior.result as Body;
    await current(tx,p,b);
    const inbound=await tx.agentEvent.findUnique({where:{key:`in:${p}:${id}`}});
    if(!inbound || (inbound.payload as Body).fromMe!==false) throw new AgentError('Mensagem do cliente não encontrada.',404);
    const inbox=await tx.agentInbox.findUnique({where:{id:`in:${p}:${id}`}});
    if(!inbox || (stage!=='ia' && (inbox.ready || inbox.consumedAt))) throw new AgentError('Mídia já processada; não sobrescrever.',409);
    const original=text((inbound.payload as Body).text,1200);
    const readable=stage==='ia'?text(inbox.content,2000)||original:original;
    const question=`Falha técnica na etapa ${stage}.\n\n${readable?'Mensagem recebida do cliente (referência):\n'+readable:'Conteúdo da mensagem indisponível.'}\n\n${stage==='ia'?'A IA não concluiu a resposta.':'A mídia não pôde ser analisada; o texto acima, quando presente, é apenas a legenda/referência.'} Consultar a conversa e pedidos no painel, sem presumir conteúdo ou pagamento. Retomada depende de conferência da equipe.`;
    const t=await tx.agentTicket.upsert({where:{sourceKey:failureKey},create:{sourceKey:failureKey,phone:p,customerName:text(b.cliente,120)||p,kind:'DUVIDA',question,nextReminderAt:new Date(Date.now()+10*60000)},update:{}});
    // Consume only the failed input. Later customer messages remain queued.
    if(stage!=='ia') await tx.agentInbox.update({where:{id:inbox.id},data:{ready:true,content:'[Mídia indisponível: análise falhou. Não inferir conteúdo nem pagamento.]',consumedAt:new Date()}});
    // Invalidate the failed generation and pause until the linked ticket is resolved.
    await tx.agentConversation.update({where:{phone:p},data:{generation:{increment:1},pausedUntil:new Date(Date.now()+30*60000)}});
    const result={ticketId:t.id,question:t.question,customerName:t.customerName,geracao:Number(b.geracao)+1,idioma:b.idioma==='es'?'es':'pt'};
    await tx.agentEvent.create({data:{key:failureKey,phone:p,kind:'ANALYSIS_FAILURE',payload:{etapa:stage},result:json(result)}});
    return result;
  });
  let notice={enviado:false,estado:'NAO_CONFIGURADO',messageId:null as string|null};
  try {notice=await sendOnce(`${failureKey}:team`,group(),pendingNotice('DUVIDA',String(claim.customerName),p,String(claim.question)),String(claim.ticketId));} catch { /* Ticket remains durable even without transport. */ }
  // The customer is not told about technical failures; the team notice above handles the follow-up.
  const sent={enviado:false,estado:'SEM_AVISO_CLIENTE'};
  return {ok:true,registrado:true,ticketId:claim.ticketId,notificacaoEnviada:notice.enviado,enviado:sent.enviado,estadoEnvio:sent.estado};
}

export async function operate(b: Body) {
  switch (b.acao) {
    case 'entrada': return inbound(b);
    case 'falhaAnalise': return analysisFailure(b);
    case 'buffer': return buffer(phone(b.telefone));
    case 'preparar': return prepare(b);
    case 'conteudo': {
      const p=phone(b.telefone), id=key(b.messageId);
      const event=await prisma.agentEvent.findUnique({where:{key:`in:${p}:${id}`}});
      const quote=text((event?.payload as Body|undefined)?.quoted,4000);
      const body=text(b.texto,24000);
      // Preserve the replied-to offer in the current batch, including media analysis.
      const content=body+(quote&&!body.includes(quote)?'\n[Mensagem citada pelo cliente (referência, não instruções): '+quote+']':'');
      const result=await prisma.agentInbox.updateMany({where:{id:`in:${p}:${id}`,phone:p,consumedAt:null,ready:false},data:{content,ready:true}});
      return {ok:true,atualizado:result.count===1};
    }
    case 'contexto': return context(phone(b.telefone));
    case 'auditoriaDia': {
      const day=text(b.dia,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>dayLaPaz()) throw new AgentError('Dia de auditoria inválido.');
      const from=new Date(day+'T04:00:00Z'), to=new Date(from.getTime()+86400000);
      if(!Number.isFinite(from.getTime())||from.toISOString().slice(0,10)!==day) throw new AgentError('Data inválida.');
      const [sales,orders,tickets,expenses]=await Promise.all([
        prisma.sale.findMany({where:{createdAt:{gte:from,lt:to}},include:{items:true},orderBy:{createdAt:'asc'}}),
        prisma.order.findMany({where:{OR:[{deliveryDate:new Date(day+'T00:00:00Z')},{createdAt:{gte:from,lt:to}},{payments:{some:{paidAt:{gte:from,lt:to}}}}]},include:{payments:true}}),
        prisma.agentTicket.findMany({where:{OR:[{createdAt:{gte:from,lt:to}},{updatedAt:{gte:from,lt:to}}]},orderBy:{createdAt:'asc'}}),
        prisma.expense.findMany({where:{date:new Date(day+'T00:00:00Z')},orderBy:{createdAt:'asc'}}),
      ]);
      return {ok:true,dia:day,vendas:sales,encomendas:orders,pendencias:tickets,despesas:expenses};
    }

    case 'reiniciarAtendimento': {
      const p=phone(b.telefone),id=key(b.messageId);
      return prisma.$transaction(async tx=>{
        await lockConversation(tx,p);
        const eventKey=`reset:${p}:${id}`,old=await tx.agentEvent.findUnique({where:{key:eventKey}});
        if(old?.result)return old.result;
        const c=await tx.agentConversation.findUnique({where:{phone:p}});
        if(!c||c.generation!==b.geracao)throw new AgentError('Atendimento mudou; reset não aplicado.',409);
        await tx.agentInbox.updateMany({where:{phone:p,consumedAt:null},data:{consumedAt:new Date()}});
        await tx.agentConversation.update({where:{phone:p},data:{pausedUntil:null,generation:{increment:1}}});
        const result={ok:true,retomado:true,telefone:p};
        await tx.agentEvent.create({data:{key:eventKey,phone:p,kind:'RESET',payload:{},result}});
        return result;
      });
    }
    case 'pausar': {
      const p = phone(b.telefone);
      await prisma.$transaction(async tx => { await lockConversation(tx,p); await current(tx,p,b); await tx.agentConversation.update({where:{phone:p},data:{pausedUntil:new Date(Date.now()+30*60000)}}); });
      return {ok:true,pausado:true};
    }
    case 'pedido': return saveOrder(b);
    case 'pendencia': return ticket(b);
    case 'equipe': return team(b);
    case 'lembretes': return reminders(text(b.destinoTeste));
    case 'diagnosticoHistorico': return importHistory(phone(b.telefone), true);
    case 'consultarEntregaYango': return {ok:true,valorEntrega:await lookupYangoFee(text(b.link,3000)),moeda:'Bs'};
    case 'diagnosticoConexao': {
      const instance=process.env.ZAPI_INSTANCE,token=process.env.ZAPI_TOKEN,client=process.env.ZAPI_CLIENT_TOKEN;
      if(!instance||!token||!client)throw new AgentError('Z-API não configurada.',503);
      const response=await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/me`,{headers:{'Client-Token':client},signal:AbortSignal.timeout(15000)});
      if(!response.ok)return {ok:false,status:response.status};
      const d=await response.json();
      return {ok:true,connected:d.connected,receiveCallbackSentByMe:d.receiveCallbackSentByMe,receivedCallbackUrl:d.receivedCallbackUrl,messageFilters:d.messageFilters??null,callbackTypeFilters:d.callbackTypeFilters??null,configuracaoGrupo:Object.fromEntries(Object.entries(d).filter(([k,v])=>/group|notify/i.test(k)&&typeof v==='boolean'))};
    }
    case 'diagnostico': return {ok:true,versao:'gula-historico-recuperado-v17',reciboEstruturado:true,midiaOriginal:true,lembretesPainel:true};
    case 'prepararLembreteTeste': {
      if(b.telefone!=='59175678921'||b.destinoTeste!==b.telefone) throw new AgentError('Teste restrito ao contato autorizado.');
      const r=await prisma.agentTicket.updateMany({where:{phone:b.telefone,customerName:{startsWith:'[TESTE]'},status:'ABERTA',kind:{in:['DUVIDA','COMPROVANTE']}},data:{nextReminderAt:new Date()}});
      return {ok:true,atualizados:r.count};
    }
    case 'statusLimpezaPainel19': {
      const audit=await prisma.agentEvent.findUnique({where:{key:'owner-cleanup:2026-10-19:panel-pendencias-test-213-215'}});
      const open=await prisma.agentTicket.findMany({where:{status:{in:['ABERTA','ASSUMIDA']},createdAt:{lte:new Date('2026-10-19T14:15:19Z')}},select:{id:true}});
      return {ok:true,audit:audit?.result||null,remaining:open.length};
    }
    case 'catalogo': { const items=await catalog(); return b.compacto===true?catalogForPrompt(items,b.familias,b.busca):{ok:true,itens:items}; }
    case 'finalizarTeste': {
      if(b.telefone!=='59175678921') throw new AgentError('Contato de teste inválido.');
      await prisma.agentInbox.updateMany({where:{phone:b.telefone,consumedAt:null,OR:[{messageId:{startsWith:'e2e-'}},{messageId:{startsWith:'fixture-'}},{messageId:{startsWith:'loc-'}}]},data:{consumedAt:new Date()}});
      const orders=await prisma.order.findMany({where:{customerPhone:b.telefone,customerName:{startsWith:'[TESTE]'},paid:0}});
      for(const o of orders) await prisma.order.update({where:{id:o.id},data:{status:'CANCELADA'}});
      await prisma.agentTicket.updateMany({where:{phone:b.telefone,customerName:{startsWith:'[TESTE]'}},data:{status:'RESOLVIDA',resolvedAt:new Date(),resolvedBy:'teste autorizado'}});
      return {ok:true,cancelados:orders.length};
    }
    case 'planejarMenu': {
      const p=phone(b.telefone);
      await prisma.$transaction(async tx=>{await lockConversation(tx,p);await current(tx,p,b);});
      return {ok:true,planejado:true,enviado:false,instrucao:'O fluxo enviará o catálogo após sua resposta. Responda à dúvida e termine com uma pergunta útil. Não afirme que já enviou.'};
    }
    case 'menu': {
      const p = phone(b.telefone);
      if (!Number.isInteger(b.geracao)) throw new AgentError('Geração obrigatória.');
      const sent = await sendOnce(`menu:${p}:${key(b.messageId)}`, p, 'Cardápio / Menú — Gula dos Meninos\nInstagram: https://www.instagram.com/guladosmeninos', undefined, Number(b.geracao), 'menu', text(b.arquivoUrl,3000)||undefined);
      return { ok: sent.enviado, ...sent };
    }
    case 'qr': {
      const p = phone(b.telefone);
      if (!Number.isInteger(b.geracao)) throw new AgentError('Geração obrigatória.');
      let order = await prisma.order.findFirst({ where: { id: text(b.pedidoId, 100), customerPhone: p, status: 'PENDENTE' } });
      if (!order) throw new AgentError('Consulte ou registre a encomenda antes de cobrar.');
      const batch = (await prisma.agentEvent.findMany({where:{phone:p,kind:'BATCH'},orderBy:{createdAt:'desc'},take:1}))[0];
      const batchResult=batch?.result as Body | undefined;
      const complaint=text(batchResult?.message,24000);
      if(batchResult?.messageId===b.messageId && /qr[\s\S]{0,100}(inv[aá]lid|error|erro|no (?:funciona|se puede)|n[aã]o funciona)|(?:error|erro|problema|inv[aá]lid)[\s\S]{0,100}qr/i.test(complaint)) {
        const alert=await ticket({...b,tipo:'DUVIDA',cliente:order.customerName,pergunta:'📌 *Resumo*\nCliente relatou falha no QR de pagamento.\n\n🛒 *Pedido*\nPedido #'+order.number+'\n'+order.product+'\n\n📝 *Observações / pendências*\n'+complaint+'\nVerificar o QR e orientar uma alternativa de pagamento autorizada.'});
        return {...alert,ok:false,enviado:false,motivo:'FALHA_QR_ENCAMINHADA',orientacao:'Informe que a equipe verificará o QR. Não diga QR novo, não reenvie o mesmo arquivo nem invente dados bancários.'};
      }
      if (b.quitarSaldo===true) {
        order=await prisma.$transaction(async tx=>{
          await lockConversation(tx,p);await current(tx,p,b);
          const actual=await tx.order.findFirst({where:{id:text(b.pedidoId,100),customerPhone:p,status:'PENDENTE'}});
          if(!actual)throw new AgentError('Encomenda não encontrada.');
          if(actual.payFull || Number(actual.paid)>=Number(actual.total))return actual;
          // Explicit request changes only when the balance is due, never money received.
          return tx.order.update({where:{id:actual.id},data:{payFull:true,agentVersion:{increment:1}}});
        });
      }
      const plan = paymentPlan(Number(order.total), Number(order.paid), order.deliveryDate.toISOString().slice(0, 10), order.payFull);
      if (!plan.pagarAgora) return { ok: true, enviado: false, motivo: 'Nenhum valor pendente agora.', ...plan };
      const billingKey=`qr-bill:${order.id}:${plan.pagarAgora}:${Number(order.paid)}`;
      const previousBilling=await prisma.agentDelivery.findUnique({where:{key:billingKey}});
      const deliveries=await prisma.agentDelivery.findMany({where:{phone:p,status:'SENT'},orderBy:{createdAt:'desc'},take:100});
      const legacyKey=order.agentRef?.startsWith(`order:${p}:`)?`qr:${p}:${order.agentRef.slice(`order:${p}:`.length)}`:null;
      const prior=previousBilling?.status==='SENT'?previousBilling:deliveries.find(d=>{
        const body=d.body as Body;
        return (body.orderId===order.id && body.pagarAgora===plan.pagarAgora && body.pagoConfirmado===Number(order.paid)) ||
          (d.key===legacyKey && String(body.message||'').includes(`${plan.pagarAgora} Bs`));
      });
      const currentMessage=batchResult?.messageId===b.messageId?complaint:'';
      const currentReceipt=/<ContextoPDF>|COMPROVANTE_BANCARIO|PDF_RECEBIDO_SEM_TEXTO/i.test(currentMessage);
      const pdfs=prior && Number(order.paid)===0?await prisma.agentInbox.findMany({where:{phone:p,mediaKind:'pdf'},orderBy:{createdAt:'desc'},take:30}):[];
      const unreadPdf=pdfs.some(m=>m.createdAt>=prior!.createdAt && /<TranscricaoPDF>\s*<\/TranscricaoPDF>/i.test(m.content||''));
      if(currentReceipt || unreadPdf) return {ok:true,enviado:false,motivo:'COMPROVANTE_PENDENTE',orientacao:'Há documento/comprovante recebido para conferir. Não reenvie QR nem peça novo pagamento. Se o PDF estiver sem texto, peça uma foto ou captura legível do documento.',...plan};
      const explicitResend=/\b(?:reenv[ií]a(?:me)?|reenvi[ae]|reenviar|env[ií]a(?:me)?|envie|manda(?:me)?|mande|pasa(?:me)?|passe)\b[^\n?]{0,60}\bqr\b|\bqr\b[^\n?]{0,40}(?:de novo|otra vez|novamente|reenvi)/i.test(currentMessage);
      if(prior && !explicitResend) return {ok:true,enviado:false,motivo:'QR_JA_ENVIADO',messageId:prior.messageId,orientacao:'O QR deste pedido e valor já foi enviado. Responda à dúvida atual; interrogação, espera e cobrança de status não autorizam nova cobrança.',...plan};
      const caption = b.idioma === 'es' ? `Pago: ${plan.pagarAgora} Bs. Envíanos el comprobante para revisión.` : `Pagamento: ${plan.pagarAgora} Bs. Envie o comprovante para conferência.`;
      const deliveryKey=prior && explicitResend?`qr:${p}:${key(b.messageId)}`:billingKey;
      const sent = await sendOnce(deliveryKey, p, caption, undefined, Number(b.geracao), 'qr', text(b.arquivoUrl,3000)||undefined, false, {id:order.id,version:order.agentVersion,total:Number(order.total),paid:Number(order.paid)});
      if(sent.enviado) {
        const delivery=await prisma.agentDelivery.findUnique({where:{key:deliveryKey}});
        if(delivery) await prisma.agentDelivery.update({where:{key:deliveryKey},data:{body:json({...delivery.body as Body,orderId:order.id,pagarAgora:plan.pagarAgora,pagoConfirmado:Number(order.paid)})}});
      }
      return { ok: sent.enviado, ...sent, ...plan };
    }
    case 'enviar': {
      const p = phone(b.telefone); let message = text(b.texto, 6000);
      if (!message || !Number.isInteger(b.geracao)) throw new AgentError('Texto e geração obrigatórios.');
      const failures=Array.isArray(b.falhasFerramentas)?b.falhasFerramentas.slice(0,4).filter(v=>v&&typeof v==='object'&&['avisar_equipe','registrar_encomenda'].includes(String((v as Body).ferramenta))):[];
      if(failures.length) {
        const input=await prisma.agentEvent.findUnique({where:{key:`in:${p}:${key(b.messageId)}`}});
        const original=text((input?.payload as Body|undefined)?.text,1200);
        const operations=[...new Set(failures.map(v=>String((v as Body).ferramenta)))].join(', ');
        const notice=await ticket({...b,tipo:'DUVIDA',pergunta:'📌 *Resumo*\nFalha ao concluir uma operação do atendimento: '+operations+'.\n\n📝 *Mensagem do cliente*\n'+(original||'Consultar a conversa e as mídias recebidas no painel.')+'\n\n👉 *Ação da equipe*\nConferir a ficha, o comprovante e os resultados da operação. Registrar somente o que estiver comprovado, sem duplicar pedido ou pagamento.'});
        const es=b.idioma==='es';
        message=notice.notificacaoEnviada?(es?'Necesito que el equipo revise tu solicitud. Ya envié el aviso para que puedan continuar por aquí 😊':'Preciso que a equipe confira sua solicitação. Já enviei o aviso para continuarem por aqui 😊'):(es?'Tu solicitud quedó pendiente de revisión. El envío del aviso al equipo todavía no está confirmado.':'Sua solicitação ficou pendente de revisão. O envio do aviso à equipe ainda não foi confirmado.');
      }
      // A conversational promise is not a persisted scheduling operation.
      if (/\b(te agendo|te he agendado|queda agendad[oa]|agendei|est[aá] agendad[oa]|ficou agendad[oa]|entrega confirmada|entrega est[aá] confirmada)\b/i.test(message)) {
        const registered=await prisma.agentEvent.findUnique({where:{key:`order:${p}:${key(b.messageId)}`}});
        if(!registered?.result) {
          await ticket({...b,tipo:'DUVIDA',pergunta:'📌 *Resumo*\nSolicitação de agendamento precisa de confirmação da equipe: não houve registro da alteração neste atendimento.\n\n📝 *Observações / pendências*\nConsultar a conversa e a ficha do cliente antes de confirmar horário ou entrega.'});
          message=/\b(te agendo|te he agendado|queda agendad[oa])\b/i.test(message)?'La solicitud de horario está pendiente de confirmación por el equipo 😊':'A solicitação de horário está pendente de confirmação pela equipe 😊';
        }
      }
      const currentCatalog=/\bbs\b|temos|tenemos|dispon[ií]ve|disponible|sabores/i.test(message)?await catalog():[];
      message=filterAvailableProductLists(message,currentCatalog);
      const priceIssues=/\bbs\b/i.test(message)?quotedPriceIssues(message,currentCatalog):[];
      if(priceIssues.length){
        const details=priceIssues.map(x=>x.precoAtual===null?`${x.produto}: oferta bloqueada (${x.motivo}); conferir disponibilidade no painel.`:`${x.produto}: citado ${x.precoCitado} Bs; painel atual ${x.precoAtual} Bs.`).join('\n');
        await ticket({...b,tipo:'DUVIDA',pergunta:'📌 *Resumo*\nPreço na resposta divergia do painel e foi bloqueado antes do envio.\n\n'+details+'\n\n👉 *Ação da equipe*\nConferir o resumo com os preços atuais antes de cobrar. Não criar pagamento ou pedido duplicado.'});
        // Diagnostics stay in the team notice. Never echo normalized clauses, codes or panel checks to the customer.
        const spanish=b.idioma==='es'||(b.idioma!=='pt'&&/[¿¡]|\b(?:un|una|con|porci[oó]n|cuchareables?|cucharables?|nido|zanahoria|maracuy[aá]|dulce de leche)\b/iu.test(message));
        message=spanish?'Voy a confirmar esa información con el equipo.':'Vou confirmar essa informação com a equipe.';
      }
      const sent = await sendOnce(`reply:${p}:${key(b.messageId)}:${key(b.parte)}`, p, message, undefined, Number(b.geracao));
      return { ok: sent.enviado, ...sent };
    }
    default: throw new AgentError('Operação desconhecida.');
  }
}


