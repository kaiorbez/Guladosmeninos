# Contexto e lembretes atualizados

A ficha mantém todo o histórico disponível e acrescenta contextoConversa: última mensagem útil do cliente, última resposta anterior não identificada como IA, localização recebida e quantidade de marcadores de análise indisponível. Origem humano identifica callbacks efetivamente enviados pelo atendente; historico_anterior mantém a incerteza de mensagens antigas cuja origem não foi preservada. Mensagens humanas usam o momento real do callback para ordenar a conversa.

Marcadores antigos não são novos pedidos nem provas de imagem. O prompt manda consultar o pedido atual, saldo, localização e resposta anterior antes de perguntar ou encaminhar. Divergência de entrega continua exigindo confirmação real da equipe: nunca muda automaticamente ENTREGUE, saldo ou horário.

Lembretes de dúvida consultam novamente o painel e o histórico. O texto de entrega apresenta os dados atuais, a resposta anterior e a localização; não copia a cobrança antiga ou pede reenvio só pela existência de falhas históricas. Se existir referência de pedido no aviso, seleciona esse pedido. Sem referência e com várias encomendas, informa a ambiguidade. Comprovantes continuam usando o relatório original da mídia, preservando a conferência.

Regressões automatizadas cobrem pedido 15 entregue e pago integralmente, cobrança antiga de 10 Bs, resposta anterior “próximo envio”, localização existente, IA posterior e falha de análise antiga. Nenhum envio real de teste é feito.
