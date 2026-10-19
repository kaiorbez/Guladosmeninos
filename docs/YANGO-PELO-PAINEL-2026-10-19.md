# Envio da Yango pelo painel — 19/10/2026

- Pedidos: formulário em entregas pendentes com valor pago confirmado (> 0), na lista e na ficha. Pendências: também no comprovante compatível vinculado ao pedido de entrega. Pedidos cancelados e retiradas não permitem envio.
- URL HTTPS com host yango.com ou subdomínio real de yango.com, sem usuário/senha ou porta alternativa. Hosts parecidos e HTTP são rejeitados. Tarifa opcional, não negativa, em Bs; consulta da tarifa no rastreio conserva a precedência do fluxo anterior. Frete não altera total, pagamento ou faturamento do pedido.
- Painel e grupo usam sendYangoLink, a mesma mensagem closeMessage e a mesma reserva persistida por pedido. Primeiro link/idioma/tarifa ficam congelados no plano; sendOnce não repete um envio incerto. O caminho antigo pelo grupo permanece disponível, inclusive para avisos legados sem pedido identificado (deduplicados por aviso).
- Após envio confirmado: deliveryLink, deliveryLinkSentAt e dispatchedAt registram “Saiu para entrega”, sem marcar “Entregue”; histórico da ação; resolução dos comprovantes vinculados e do registro de despacho; liberação do telefone/LID pela ponte autenticada já existente. A IA recebe o rastreio e a saída no contexto real do pedido.
- O painel notifica o grupo uma única vez: “Link da Yango enviado para <cliente> pelo painel.” O aviso também é vinculado ao despacho, para uma resposta acidental não duplicar o rastreio. Falha desse aviso não altera o sucesso do envio ao cliente.
- Vinculação histórica exclusivamente por eventos RECEIPT_PAYMENT e telefone correspondente. Links anteriores com envio SENT são restaurados sem mensagens novas; estado UNKNOWN não é promovido a sucesso. Fichas e pagamentos históricos permanecem preservados.
- Campos de esquema novos são opcionais. A carga idempotente 2026-10-19-yango-painel-vinculos-historicos somente associa registros e restaura metadados de envios confirmados.

Aviso futuro ao grupo: “Pagamento compatível. Quando sair, envie o link da Yango pelo painel (botão Enviar ao cliente) ou responda esta mensagem com o link.”

Validação: concorrência painel/grupo, link diferente repetido, dois pedidos do mesmo cliente, idioma espanhol, tarifa opcional, falha no aviso do grupo, timeout sem reenvio e sem despacho/resolução, pedido sem pagamento/retirada/cancelado, URL maliciosa e restauração histórica idempotente. Build e TypeScript aprovados. Nenhuma mensagem real foi enviada nos testes.
