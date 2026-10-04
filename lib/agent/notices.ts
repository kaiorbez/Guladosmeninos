const divider = '━━━━━━━━━━━━━━━';
const header = '🔔 *GULA — AVISO DO AGENTE*';

/** Keep structured reports; make older plain-text tickets readable without inventing fields. */
export function noticeDetails(question: string) {
  const body = question.trim().split(divider)[0].trim();
  if (/📌\s*\*?Resumo/i.test(body)) return body.replace(/\n{3,}/g, '\n\n');
  const paragraphs = body.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/u);
  return `📌 *Resumo*\n${paragraphs.join('\n\n') || 'Detalhes não informados.'}`;
}

export function groupNotice(title: string, name: string, phone: string, details: string, action: string) {
  return `${header}\n${divider}\n*${title}*\n\n👤 *Cliente:* ${name}\n📱 wa.me/${phone}\n\n${details.trim()}\n\n${divider}\n👉 *Ação da equipe*\n${action}`;
}

export function pendingNotice(kind: string, name: string, phone: string, question: string, reminder = false) {
  const receipt = kind === 'COMPROVANTE';
  const title = receipt
    ? (reminder ? '⏰ COMPROVANTE PENDENTE — VERIFICAR PAGAMENTO' : '💰 COMPROVANTE RECEBIDO — VERIFICAR PAGAMENTO')
    : (reminder ? '⏰ LEMBRETE — DÚVIDA AINDA PENDENTE' : '❓ DÚVIDA SEM RESPOSTA');
  const originalAction = question.includes('👉 *Ação da equipe*') ? question.split('👉 *Ação da equipe*').slice(1).join('👉 *Ação da equipe*').trim() : '';
  const action = receipt
    ? originalAction || 'Conferir o comprovante e o crédito no banco antes de confirmar o pagamento. Responder a este aviso com “Respondido” ou “Resolvido” após a conferência.'
    : 'Verificar a dúvida acima e informar a resposta ou o orçamento. Depois de atender, responder a este aviso com “Respondido” ou “Resolvido”.';
  return groupNotice(title, name, phone, noticeDetails(question), action);
}

export function orderNotice(order: {numero: number; produto: string; data: string; horario: string | null; total: number; pagarAgora: number}, name: string, phone: string, mode: string, address: string, notes: string) {
  const details = `📌 *Resumo*\nEncomenda #${order.numero} registrada pelo WhatsApp.\n\n🛒 *Pedido*\n${order.produto}\n\nTotal: ${order.total} Bs\nPagar agora: ${order.pagarAgora} Bs\n\n📅 *Data e horário*\n${order.data}${order.horario ? ' às ' + order.horario : '\nHorário não informado'}\n\n🚚 *Entrega / retirada*\n${mode === 'RETIRADA' ? 'Retirada na loja' : 'Entrega'}\n${address || 'Endereço não informado'}\n\n📝 *Observações*\n${notes || 'Nenhuma observação informada.'}`;
  return groupNotice('🛒 ENCOMENDA RECEBIDA', name, phone, details, 'Revisar a encomenda e acompanhar o pagamento. Quando sair para entrega, responder a este aviso com o link da Yango para encaminhar ao cliente.');
}
