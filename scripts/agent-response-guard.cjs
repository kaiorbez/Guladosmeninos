function guardResponse(output, input, previous, hasActions) {
  // Correct the observed mixed-language greeting without altering names/URLs.
  let result = String(output || '').replace(/Чем\s+posso\s+te\s+ajudar\?/gu, 'Como posso te ajudar?');
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
