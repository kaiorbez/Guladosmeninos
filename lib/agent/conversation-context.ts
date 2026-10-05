type Message = { papel: string; texto: unknown; data: string; origem?: string };
export function recoveredText(content: unknown, raw: unknown) {
 const stored=String(content||'');
 return /não pôde ser analisada|Falha anterior de análise/i.test(stored)&&typeof raw==='string'&&raw.trim()?raw:content;
}
export function conversationFacts(history: Message[]) {
 const ordered=[...history].sort((a,b)=>a.data.localeCompare(b.data));
 const unavailable=(m:Message)=>/não pôde ser analisada|conteúdo não (?:analisado|recuperado)|Falha anterior de análise/i.test(String(m.texto));
 const clients=ordered.filter(m=>m.papel==='cliente');
 const location=[...clients].reverse().find(m=>/https:\/\/maps\.google\.com\//i.test(String(m.texto)));
 return {
  ultimaMensagemCliente:[...clients].reverse().find(m=>!unavailable(m))||null,
  ultimaRespostaAnterior:[...ordered].reverse().find(m=>m.papel==='atendente'&&m.origem!=='agente'&&typeof m.texto==='string'&&m.texto.trim()&&!unavailable(m))||null,
  localizacaoRecebida:location?String(location.texto).match(/https:\/\/maps\.google\.com\/[^\s<>]+/i)?.[0]||null:null,
  falhasAnterioresDeAnalise:clients.filter(unavailable).length,
  orientacao:'Cruzar com pedidos e pagamentos atuais. Falha antiga de análise não é nova dúvida. Resposta anterior não comprova entrega ou crédito bancário. Histórico parcial não significa ausência de contexto.'
 };
}
/** Refresh notices from persisted facts without changing orders or payments. */
export function currentReminderDetails(question:string,facts:ReturnType<typeof conversationFacts>,orders:Record<string,unknown>[]) {
 const delivery=/yango|entrega|env[ií]o/i.test(question);
 const original=question.split(/🛒|📅|🚚|📝|👉/)[0].replace(/📌\s*\*?Resumo\*?\s*/i,'').trim();
 const summary=delivery?'Confirmar a situação da entrega do pedido existente, considerando a resposta anterior e os dados atuais abaixo.':original.slice(0,450);
 const number=question.match(/pedido\s*(?:n[º°o.]*)?\s*#?\s*(\d+)/i)?.[1];
 const linked=orders.filter(o=>(String(o.id||'').length>10&&question.includes(String(o.id)))||(number&&String(o.numero)===number));
 const selected=linked.length?linked:orders.slice(0,3);
 const lines=selected.map(o=>`Pedido nº ${o.numero}: ${o.produto}. Situação no painel: ${o.situacao}. Total: ${o.total} Bs. Pago confirmado: ${o.pagoConfirmado} Bs. Saldo: ${o.saldo} Bs.\nData: ${o.data}. Horário no painel: ${o.horario||'Não informado'}.\nEntrega/retirada: ${o.modalidade||'Não informado'}. Endereço: ${o.endereco||'Não informado'}.`).join('\n\n');
 return `📌 *Resumo*\n${summary||'Conferir a pendência registrada.'}\n\n🛒 *Dados atuais do painel*\n${lines||'Nenhuma encomenda vinculada encontrada.'}`+
  (!linked.length&&orders.length>1?'\nHá mais de uma encomenda vinculada. Conferir qual corresponde à dúvida antes de agir.':'')+
  (facts.ultimaRespostaAnterior?`\n\n💬 *Resposta anterior no WhatsApp*\n${String(facts.ultimaRespostaAnterior.texto).slice(0,650)}`:'')+
  (facts.localizacaoRecebida?`\n\n📍 *Localização já recebida*\n${facts.localizacaoRecebida}`:'')+
  (delivery?'\n\n📝 *Conferência necessária*\nSe o painel indicar ENTREGUE, conferir a divergência antes de prometer outro envio. Não repetir cobranças ou pedir localização já recebida.':'');
}
