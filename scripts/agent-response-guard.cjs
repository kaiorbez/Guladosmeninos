function guardResponse(output, input, previous, hasActions) {
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
}
module.exports = { guardResponse };
