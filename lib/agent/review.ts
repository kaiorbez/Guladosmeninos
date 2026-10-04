import { AgentError, dateOnly, money, text } from './rules';
function receiptDate(value: unknown) {
  const date = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  try { return dateOnly(date); } catch { return null; }
}
export function receiptReview(r: Record<string, unknown>, expected: number | null, today: string) {
  const value = typeof r.valor === 'number' && Number.isFinite(r.valor) && r.valor >= 0 ? money(r.valor) : null;
  const currency = text(r.moeda, 20).toUpperCase();
  const issues: string[] = [];
  if (value === null) issues.push('Valor ilegível/ausente');
  if (!['BS', 'BOB', 'BS.'].includes(currency)) issues.push('Moeda diferente de Bs ou não identificada');
  if (expected === null) issues.push('Pedido/valor solicitado não identificado');
  else if (value !== null && value !== money(expected)) issues.push(`Valor diverge: solicitado ${expected} Bs; comprovante ${value} ${currency}`);
  const beneficiary = text(r.beneficiario, 200);
  const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z ]/g,' ').trim();
  const names = normalize(beneficiary).split(/\s+/);
  if (!['MATHEUS','LAZZARINI','FRANCA'].every(n=>names.includes(n))) issues.push('Beneficiário diferente da referência oficial ou ilegível: conferir');
  if (!/GANADERO/i.test(text(r.bancoDestino,200))) issues.push('Banco de destino não identificado como Banco Ganadero: conferir');
  const date = text(r.data, 40);
  if (!date) issues.push('Data ausente/ilegível');
  else if (!receiptDate(date)) issues.push('Data inválida/ilegível: conferir com a equipe');
  else if (date !== today) issues.push('Data diferente de hoje: conferir vínculo ao pedido; não rejeitar automaticamente');
  return { valorVisivel:value,valorSolicitado:expected,resultado:issues.length?'CONFERIR DIVERGÊNCIAS':'VALOR E DESTINATÁRIO COMPATÍVEIS',alertas:issues,pagamentoConfirmado:false };
}
/** Accept only an explicit delivery amount from staff, never order totals or URL digits. */
export function deliveryFee(message: string): number | null {
 const clean=message.replace(/https?:\/\/\S+/gi,'');
 const values:number[]=[];
 for(const line of clean.split(/\r?\n/)) {
  const label=/(?:\b(?:entrega|frete|env[ií]o|tarifa)(?:\s+(?:da entrega|de entrega|del env[ií]o))?\s*[:=]?\s*)(?:Bs\.?\s*|BOB\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:Bs\.?|BOB)\b/i;
  const standalone=/^\s*(?:Bs\.?\s*|BOB\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:Bs\.?|BOB)\.?\s*$/i;
  const match=line.match(label)||line.match(standalone);
  if(match) values.push(Number(match[1].replace(',','.')));
 }
 if(values.some(v=>!Number.isFinite(v))||new Set(values).size>1) throw new AgentError('Valores de entrega divergentes: informe uma única tarifa em Bs.');
 return values[0]??null;
}
export function closeMessage(language: 'pt'|'es', link?: string, fee?: number | null) {
 const es=language==='es';
 const amount=fee!==undefined&&fee!==null?`${es?'Costo del envío':'Valor da entrega'}: ${fee.toFixed(2).replace(/\.00$/,'').replace('.',',')} Bs.\n`:'';
 const tracking=link?(es?`🚚 Sigue tu entrega:\n${link}\n${amount}\n`:`🚚 Acompanhe sua entrega:\n${link}\n${amount}\n`):'';
 return tracking+(es?'¡Gracias por elegir Gula dos Meninos! 💛\nSíguenos para conocer novedades y promociones:':'Obrigada por escolher a Gula dos Meninos! 💛\nAcompanhe nossas novidades e promoções:')+'\nInstagram: https://www.instagram.com/guladosmeninos\nTikTok: https://www.tiktok.com/@guladosmeninos\n'+(es?'Grupo de promociones: ':'Grupo de promoções: ')+'https://chat.whatsapp.com/CJhCvgejgky6VtkTEFRko2';
}

/** Internal notice built from persisted order and visible receipt fields, never LLM prose. */
export function receiptNotice(r:Record<string,unknown>, order:Record<string,unknown>|null, review:ReturnType<typeof receiptReview>) {
 const shown=(v:unknown)=>typeof v==='number'?String(v):text(v,1000)||'Não informado / não legível';
 const amount=review.valorVisivel===null?'Não legível':`${review.valorVisivel} ${text(r.moeda,20)||'moeda não identificada'}`;
 const lines=Array.isArray(order?.itens)?order.itens.map((i:Record<string,unknown>)=>`• ${i.quantidade} ${shown(i.descricao)} — ${Number(i.quantidade)*Number(i.precoUnitario)} Bs`).join('\n'):'Pedido não identificado';
 const ok=review.alertas.length===0;
 const summary=ok?`✅ CONFERE: comprovante de ${amount} para ${shown(order?.produto)}.`:`⚠️ CONFERIR: ${review.alertas.join('; ')}.`;
 let date=shown(r.data);
 if(receiptDate(date))date=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const scheduled=order?.data?`Data da entrega: ${shown(order.data)}${order.horario?' às '+shown(order.horario):''}\n`:'';
 const location=order?`${order.modalidade==='RETIRADA'?'Retirada na loja':'Entrega'}${order.endereco?' — '+shown(order.endereco):''}${order.horario?' — '+shown(order.horario):''}${order.observacoes?'\nObservações: '+shown(order.observacoes):''}`:'Modalidade/endereço não identificado';
 return `📌 *Resumo*\n${summary}\n\n🛒 *Pedido*\n${lines}\n\nTotal: ${order?shown(order.total)+' Bs':'Não identificado'}\nPagar ahora: ${order?shown(order.pagarAgora)+' Bs':'Não identificado'}\n\n🧾 *Comprovante mostra*\nValor: ${amount}\nBeneficiário: ${shown(r.beneficiario)}\nBanco: ${shown(r.bancoDestino)}\nData: ${date}\nHora: ${shown(r.hora)}\n\n🚚 *Entrega / retirada*\n${scheduled}${location}\n\n━━━━━━━━━━━━━━━\n👉 *Ação da equipe*\n${ok?'Comprovante compatível com o pedido. Seguir a programação de preparo e entrega registrada no painel.':`Conferir o comprovante com a equipe e verificar as divergências acima antes de confirmar o pedido. A leitura do comprovante não confirma crédito bancário.`}`;
}
