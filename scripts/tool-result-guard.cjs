function failedCommercialTools(steps, output, current = {}) {
  const allowed = ['avisar_equipe', 'registrar_encomenda'];
  const pending = new Map();
  let receiptRegistered = false;
  let orderRegistered = false;
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
  return failed;
}
module.exports = { failedCommercialTools };
