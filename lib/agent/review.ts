import { money, text } from './rules';
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
  else if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date !== today) issues.push('Data diferente de hoje: conferir vínculo ao pedido; não rejeitar automaticamente');
  return { valorVisivel:value,valorSolicitado:expected,resultado:issues.length?'CONFERIR DIVERGÊNCIAS':'VALOR E DESTINATÁRIO COMPATÍVEIS',alertas:issues,pagamentoConfirmado:false };
}
export function closeMessage(language: 'pt'|'es', link?: string) {
 const es=language==='es';
 const tracking=link?(es?`🚚 Sigue tu entrega:\n${link}\n\n`:`🚚 Acompanhe sua entrega:\n${link}\n\n`):'';
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
 if(/^\d{4}-\d{2}-\d{2}$/.test(date))date=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const location=order?`${order.modalidade==='RETIRADA'?'Retirada na loja':'Entrega'}${order.endereco?' — '+shown(order.endereco):''}${order.horario?' — '+shown(order.horario):''}${order.observacoes?'\nObservações: '+shown(order.observacoes):''}`:'Modalidade/endereço não identificado';
 return `📌 *Resumo*\n${summary}\n\n🛒 *Pedido*\n${lines}\n\nTotal: ${order?shown(order.total)+' Bs':'Não identificado'}\nPagar ahora: ${order?shown(order.pagarAgora)+' Bs':'Não identificado'}\n\n🧾 *Comprovante mostra*\nValor: ${amount}\nBeneficiário: ${shown(r.beneficiario)}\nBanco: ${shown(r.bancoDestino)}\nData: ${date}\nHora: ${shown(r.hora)}\n\n🚚 *Entrega / retirada*\n${location}\n\n━━━━━━━━━━━━━━━\n👉 *Ação da equipe*\nConferir no banco se caíram ${amount} na conta da Gula e confirmar o pedido com o cliente.${ok?'':' Verificar as divergências acima antes de confirmar.'} A leitura do comprovante não confirma crédito bancário.`;
}
