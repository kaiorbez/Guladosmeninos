const divider = '━━━━━━━━━━━━━━━';
const header = '🔔 *GULA — AVISO DO AGENTE*';

/** Presentation only: keep business references and agreed times, hide technical metadata. */
export function teamDisplay(value: string) {
  return value
    .replace(/\s*\(\s*(?:id|pedidoId|messageId|ticketId|executionId)\s*[:=]?\s*[a-z0-9_-]{15,}\s*\)/gi, '')
    .replace(/\b(?:pedidoId|messageId|ticketId|executionId|id)\s*[:=]\s*[a-z0-9_-]{15,}\b/gi, '')
    .replace(/\s*\((\d{1,2}:\d{2})(?:\s*(?:UTC|GMT|Z))?\)/gi, (match, _time, offset, source) => {
      const prefix = source.slice(Math.max(0, offset - 70), offset);
      // An explicit delivery, pickup or receipt time is still useful to the team.
      if (/(?:hor[aá]rio|hora|entrega|retirada)[^.!?\n]{0,35}$|(?:para|[aà]s)\s*$/i.test(prefix)) return match;
      return '';
    })
    .replace(/[ \t]{2,}/g, ' ');
}

/** Keep structured reports; make older plain-text tickets readable without inventing fields. */
export function noticeDetails(question: string) {
  const body = question.trim().split(divider)[0].split('👉 *Ação da equipe*')[0].trim();
  if (/📌\s*\*?Resumo/i.test(body)) return body.replace(/\n{3,}/g, '\n\n');
  const paragraphs = body.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/u);
  return `📌 *Resumo*\n${paragraphs.join('\n\n') || 'Detalhes não informados.'}`;
}

export function groupNotice(title: string, name: string, phone: string, details: string, action: string) {
  // Compact layout: who, what and the one action the team must take, readable at a glance on a phone.
  return `${header}\n*${title}* · ${name}\n📱 wa.me/${phone}\n\n${teamDisplay(details.trim())}\n\n👉 ${teamDisplay(action)}`;
}

export function compatibleReceipt(kind: string, question: string) {
  return kind === 'COMPROVANTE' && question.startsWith('📌 *Resumo*\n✅ CONFERE:');
}

export function pendingNotice(kind: string, name: string, phone: string, question: string, reminder = false) {
  const receipt = kind === 'COMPROVANTE';
  const compatible = compatibleReceipt(kind, question);
  const title = receipt
    ? (compatible ? '💰 COMPROVANTE RECEBIDO' : reminder ? '⏰ COMPROVANTE PENDENTE — VERIFICAR PAGAMENTO' : '💰 COMPROVANTE RECEBIDO — VERIFICAR PAGAMENTO')
    : (reminder ? '⏰ LEMBRETE — DÚVIDA AINDA PENDENTE' : '❓ DÚVIDA SEM RESPOSTA');
  const originalAction = question.includes('👉 *Ação da equipe*') ? question.split('👉 *Ação da equipe*').slice(1).join('👉 *Ação da equipe*').trim() : '';
  const action = receipt
    ? compatible ? 'Pagamento compatível. Quando sair, envie o link da Yango pelo painel (botão Enviar ao cliente) ou responda esta mensagem com o link.' : originalAction || 'Confira o crédito no banco antes de confirmar. Depois, responda ESTA mensagem com “Resolvido”.'
    : 'Atenda o cliente no WhatsApp. Ao terminar, responda ESTA mensagem com “Resolvido”.';
  return groupNotice(title, name, phone, noticeDetails(question), action);
}

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function shortDate(day: string) {
  const d = new Date(day + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) ? `${WEEK[d.getUTCDay()]} ${day.slice(8, 10)}/${day.slice(5, 7)}` : day;
}

export function orderNotice(order: {numero: number; produto: string; data: string; horario: string | null; total: number; pagarAgora: number}, name: string, phone: string, mode: string, address: string, notes: string) {
  const details = [
    `🛒 ${order.produto}`,
    `💰 Total ${order.total} Bs · pagar agora ${order.pagarAgora} Bs`,
    `📅 ${shortDate(order.data)}${order.horario ? ' às ' + order.horario : ' (horário não informado)'}`,
    `🚚 ${mode === 'RETIRADA' ? 'Retirada na loja' : 'Entrega: ' + (address || 'endereço não informado')}`,
    ...(notes ? [`📝 ${notes}`] : []),
  ].join('\n');
  return groupNotice(`🛒 ENCOMENDA #${order.numero}`, name, phone, details, 'Ao sair para entrega, responda ESTA mensagem com o link da Yango: ele vai direto para o cliente.');
}
