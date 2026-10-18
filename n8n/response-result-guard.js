function failedCommercialTools(steps, output, current = {}) {
  const allowed = ['avisar_equipe', 'registrar_encomenda'];
  const pending = new Map();
  let receiptRegistered = false;
  // A status reply may describe a real order from the authenticated customer context.
  // It does not require another write in this turn, and must not erase an actual failed write below.
  const statusGreeting=/^(?:h[oó]l+a+|o+i+|ol[aá]+|bom dia|boa tarde|boa noite|buenos dias|buenas tardes|buenas noches)[\s!?.😊👍]*$/iu.test(String(current.message||'').trim());
  const persisted=Array.isArray(current.pedidos)?current.pedidos.filter(p=>p&&p.id&&p.situacao==='PENDENTE'):[];
  let orderRegistered = statusGreeting && persisted.length===1;
  for (const step of steps || []) {
    const name = step.action?.tool;
    if (!allowed.includes(name)) continue;
    let result;
    try { result = typeof step.observation === 'string' ? JSON.parse(step.observation) : step.observation; if (Array.isArray(result)) result = result[0]; } catch { result = null; }
    const bad = !result || result.ok === false || Boolean(result.error) || result.registrado !== true;
    const operation = name + ':' + (name === 'avisar_equipe' ? String(step.action?.toolInput?.tipo || 'DUVIDA') : 'pedido');
    if (name === 'registrar_encomenda') orderRegistered = !bad;
    if (name === 'avisar_equipe' && step.action?.toolInput?.tipo === 'COMPROVANTE') receiptRegistered = !bad;
    if (bad) pending.set(operation, { ferramenta: name, motivo: 'A operação não foi registrada; conferir a conversa e a ficha.' });
    else if (name === 'avisar_equipe' && result.notificacaoEnviada !== true) pending.set(operation, { ferramenta: name, motivo: 'A pendência foi registrada, mas o envio do aviso à equipe não foi confirmado.' });
    else pending.delete(operation);
  }
  const failed = [...pending.values()];
  const receiptClaim = /(?:recebi|recib[ií]|recebemos|recibimos).{0,20}(?:comprovante|comprobante)|(?:comprovante|comprobante)\s+(?:recebido|recibido)/iu.test(String(output || ''));
  if (receiptClaim && !receiptRegistered && !failed.some(f => f.ferramenta === 'avisar_equipe')) failed.push({ ferramenta: 'avisar_equipe', motivo: 'A resposta acusava comprovante, mas não houve registro confirmado do recebimento.' });
  const orderClaim = String(output || '').split(/[.!?\n]+/).some(sentence => {
    const claim = /(?:pedido|encomenda|solicitud).{0,35}(?:registrad[oa]|cadastrad[oa])|(?:registr[eé]|registrei|cadastr[ée]i).{0,30}(?:pedido|encomenda|solicitud)/iu.test(sentence);
    const denied = /(?:n[aã]o|no|ainda|todav[ií]a|sem|sin|antes de|preciso|necesito|falta|quando|cuando|depois de|despu[eé]s de).{0,70}(?:registr|cadastr)/iu.test(sentence);
    return claim && !denied;
  });
  if (orderClaim && !orderRegistered && !failed.some(f => f.ferramenta === 'registrar_encomenda')) failed.push({ ferramenta: 'registrar_encomenda', motivo: 'A resposta afirmava registro de pedido, mas não houve gravação confirmada.' });
  const promisesQr=String(output||'').split(/[.!\n]+/).some(sentence=>!/[?¿]/.test(sentence)&&/\b(?:te env[ií]o|voy a enviar|vou enviar|enviarei|estou enviando)\b.{0,60}\bqr\b/iu.test(sentence));
  if(promisesQr&&!orderRegistered&&!persisted.length&&!failed.some(f=>f.ferramenta==='registrar_encomenda'))failed.push({ferramenta:'registrar_encomenda',motivo:'A resposta prometia cobrança por QR, mas não há encomenda registrada no contexto nem gravação confirmada.'});
  return failed;
}

const a=$('Agente Gula').first().json;
let text=String(a.output||'').trim();
const steps=a.intermediateSteps||[];
const outcomes=steps.map(s=>{try { let o=typeof s.observation==='string'?JSON.parse(s.observation):s.observation; if(Array.isArray(o)) o=o[0]; return {tool:s.action?.tool, result:o||{}};}catch{return {tool:s.action?.tool,result:{}};}});
const successful=(tool,flag)=>outcomes.some(o=>o.tool===tool && o.result[flag]===true);
const current=$('Consultar Ficha do Cliente').first().json;
const idioma=(function protectionLanguage(history, input) {
 const samples=[...(history||[]).filter(m=>m.papel==='cliente').map(m=>m.texto||''),input||''];
 for(const s of samples.reverse()){
  if(/\b(voc[eê]|obrigad[oa]|quero|gostaria|qual|quanto|amanh[ãa]|boa (?:tarde|noite)|bolos?|recheio)\b/iu.test(s))return 'pt';
  if(/[¿¡]|\b(quiero|quisiera|cu[aá]nto|cu[aá]l|gracias|buenas|buenos|ma[ñn]ana|torta|precio|env[ií]o)\b/iu.test(s))return 'es';
 }return 'pt';
})(current.historico,current.message);
const falhasFerramentas=failedCommercialTools(steps,a.output,current);
const claimsReceipt=/(?:recebi|recib[ií]|recebemos|recibimos).{0,20}(?:comprovante|comprobante)|(?:comprovante|comprobante)\s+(?:recebido|recibido)/iu.test(text);
const actualReceipt=Array.isArray(current.mediaIds)&&current.mediaIds.length>0&&successful('avisar_equipe','registrado');
const claimsRegistered=(function claimsPositiveRegistration(value) {
 return String(value||'').split(/[.!?\n]+/).some(sentence=>{
  const claim=/(?:pedido|encomenda|solicitud).{0,35}(?:registrad[oa]|cadastrad[oa])|(?:registr[eé]|registrei|cadastr[ée]i).{0,30}(?:pedido|encomenda|solicitud)/iu.test(sentence);
  const negative=/(?:n[aã]o|no|a[uú]n no|todav[ií]a no|ainda n[aã]o|sem|sin|antes de|precis[oa]|necesito|falta).{0,70}(?:registr|cadastr)/iu.test(sentence);
  const conditional=/(?:se |si |quando |cuando |ap[oó]s |depois de |despu[eé]s de ).{0,50}(?:registr|cadastr)/iu.test(sentence);
  return claim&&!negative&&!conditional;
 });
})(text);
const claimsTeam=/(j[aá]\s+(avisei|passei|encaminhei)|equipe.{0,12}(avisada|notificada))/i.test(text);
const claimsReturn=/vou verificar.{0,30}(respondo|retorno)|j[aá] te respondo/i.test(text);
if ((claimsReceipt&&!actualReceipt)||(claimsRegistered&&!successful('registrar_encomenda','registrado'))||(claimsTeam&&!successful('avisar_equipe','notificacaoEnviada'))||claimsReturn) {
 const spanish=idioma==='es';
 text=successful('avisar_equipe','registrado')?(spanish?'Tu solicitud está registrada y pendiente de revisión del equipo.':'Sua solicitação está registrada no painel e aguarda conferência da equipe.'):(spanish?'Todavía no tengo confirmación de esa información. Necesito que el equipo la revise.':'Ainda não tenho confirmação para essa informação. Preciso da conferência da equipe.');
}
// AUDIT_RESPONSE_GUARD
const prior=(current.historico||[]).filter(m=>m.papel==='atendente').at(-1)?.texto||'';
text=(function guardResponse(output, input, previous, hasActions) {
  // Correct the observed mixed-language greeting without altering names/URLs.
  let result = String(output || '').replace(/Чем\s+posso\s+te\s+ajudar\?/gu, 'Como posso te ajudar?');
  // Suppress observed planning prefaces, preserving the useful customer-facing answer.
  result=result.replace(/^(?:(?:Pronto para o resumo|Vou fazer uma oferta[^.!?]*)[.!]\s*)+/iu,'');
  // Exact repeated paragraphs add no information; preserve distinct quantities and prices.
  const seen=new Set();
  result=result.split(/\n\s*\n/).filter(part=>{const normalized=part.trim().replace(/\s+/g,' ');if(!normalized)return false;if(seen.has(normalized))return false;seen.add(normalized);return true;}).join('\n\n');
  // Scanned PDFs have no extractable text. Do not leave the customer waiting silently.
  if (/<TranscricaoPDF>\s*<\/TranscricaoPDF>/iu.test(String(input || ''))) {
    const es=/[¿¡]|\b(pago|env[ií]anos|quieres|necesitas|porci[oó]n)\b/iu.test(String(previous || ''));
    return es?'Recibí el PDF, pero no pude leer su contenido. ¿Puedes enviar una foto o captura de pantalla del documento?':'Recebi o PDF, mas não consegui ler o conteúdo. Pode enviar uma foto ou captura de tela do documento?';
  }
  const acknowledgment = /^(ok(?:ay)?|obrigad[oa](?:s)?|muchas gracias|gracias|valeu|certo|combinado)[\s!.,😊👍🙏💛]*$/iu.test(String(input || '').trim());
  const waiting = /aguard|pendente|pendiente|confirm.*equipe|equipo.*confirm|equipe.*verificar|equipo.*verificar/iu.test(String(previous || ''));
  // An acceptance of a question or a tool action must never be discarded.
  if (!hasActions && acknowledgment && waiting && !/[?¿]/u.test(String(previous || ''))) result = '';
  const deliveryAcknowledgment = /^(?:(?:ok(?:ay)?|bueno|certo|t[aá] bom)[\s,.!]+)?(?:espero (?:el )?(?:delivery|pedido)|(?:vou )?(?:aguardar|esperar) (?:a )?entrega)[\s!.,😊👍🙏💛]*$/iu.test(String(input || '').trim());
  const deliveryAlreadyHandled = /prepara|delivery|entrega|enviado|en camino/iu.test(String(previous || ''));
  if (!hasActions && deliveryAcknowledgment && deliveryAlreadyHandled && !/[?¿]/u.test(String(previous || ''))) result = '';
  return result;
})(text,current.message,prior,steps.length>0);
if (/^\[?SEM_RESPOSTA\]?$/.test(text)) text='';
if(falhasFerramentas.length) text=idioma==='es'?'Tu solicitud necesita revisión del equipo.':'Sua solicitação precisa de conferência da equipe.';
return [{json:{output:{mensagens:text?[text]:[]},falhasFerramentas,idioma}}];