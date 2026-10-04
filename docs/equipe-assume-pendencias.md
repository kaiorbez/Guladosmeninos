# Pendências assumidas pela equipe

Quando a equipe responde citando um aviso do agente no grupo, uma resposta comum (por exemplo, “Vou verificar”) marca o aviso como ASSUMIDA. A pendência continua no painel como “Em atendimento · lembretes suspensos”, sem alterar pedido ou pagamento. A conversa da IA é pausada por 30 minutos e a geração é invalidada para bloquear respostas atrasadas.

Quando um atendente escreve diretamente ao cliente pelo número da Gula, o callback humano marca as pendências abertas daquele cliente como ASSUMIDA. Mensagens antigas e callbacks duplicados não assumem novas pendências.

“Respondido” e “Resolvido” continuam encerrando a pendência e liberando a IA. Os comandos de preparo e envio Yango continuam próprios, com confirmação de envio antes de encerrar. Uma resposta comum no grupo não é encaminhada automaticamente ao cliente.

O cron só busca ABERTA. O transporte verifica novamente o estado antes de enviar, sob trava da conversa do cliente, cancelando lembretes que já estavam selecionados quando a equipe assumiu. Um envio já concluído não pode ser retirado.

O roteamento aceita resposta textual citada somente no grupo configurado e ignora `fromApi=true`. Citações sem vínculo com aviso são ignoradas. A equipe deve usar a função Responder no aviso correto, ou atender diretamente no privado. Conversas gerais do grupo não alteram pendências.

Validação: testes automatizados simulam banco e transporte para verificar tomada de atendimento, cancelamento de lembrete já selecionado, bloqueio de resposta atrasada, resolução posterior, isolamento por cliente, callbacks repetidos e mensagens antigas. Teste de roteamento cobre proprietário `fromMe`, eco `fromApi`, grupo errado e referência citada. Nenhuma mensagem real foi enviada durante esta alteração.
