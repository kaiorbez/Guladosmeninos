# Tratamento de falha de análise

Implementação local, ainda não conectada ao workflow ativo nem validada em produção.

Nas saídas de erro de imagem, áudio e Agente Gula, chamar `POST /api/agente/operacoes` com a credencial Painel Gula API. O handler não chama OpenAI. Exemplo de contrato (valores devem vir da entrada autenticada, não do erro ou da IA):

```json
{
  "acao": "falhaAnalise",
  "telefone": "<telefone da entrada>",
  "messageId": "<id da mensagem do cliente>",
  "geracao": 1,
  "etapa": "imagem",
  "idioma": "es",
  "cliente": "<nome recebido>"
}
```

`etapa` aceita `imagem`, `audio` ou `ia`. Usar a geração recebida na entrada/preparação. Idioma vem do texto do cliente, nunca do DDI. Não enviar tokens, mensagens completas de erro ou comprovantes no contrato. Todos os erros terminais podem ser encaminhados, incluindo saldo esgotado; não executar retentativas irrestritas de 429 de quota.

A operação exige uma mensagem real vinculada ao cliente e geração atual sem pausa humana. Em mídia, exige análise ainda pendente. Registra pendência DUVIDA, marca somente a mídia falhada como indisponível/consumida, invalida a geração e pausa o agente por 30 minutos. Em falha de IA, preserva o lote já consumido e não o reproduz. Mensagens posteriores ficam na fila. A equipe deve consultar histórico/pedido e responder ao aviso vinculado com Respondido/Resolvido; a retomada ocorre nas próximas mensagens. Não há replay automático após recarga.

O aviso da equipe e a resposta segura ao cliente possuem chaves duráveis separadas. `registrado`, `notificacaoEnviada`, `enviado` e `estadoEnvio` distinguem persistência e entrega. Um callback concorrente pode observar SENDING; UNKNOWN/SENDING não devem ser reenviados automaticamente. Falha de transporte permanece no painel. Intervenção humana ou nova geração impede uma resposta técnica atrasada. Nada registra pagamento ou encomenda.

Antes de conectar, comparar o JSON ativo do n8n com os arquivos do repositório e confirmar a versão do backend no Railway. Não importar o export antigo por cima do fluxo ativo. A saída de erro deve terminar após esta operação, sem passar pelo envio normal da IA. Se houver 409 por geração superada, não forçar envio: conferir fila/conversa atual. Este contrato não fornece temporizador autônomo para falhas que não cheguem à saída de erro; o timeout de mídia em prepare continua sendo apenas uma proteção complementar.

Validação pendente: chamadas reais no destino próprio autorizado, falha controlada de quota, imagem/áudio/IA, entrega dos avisos, resolução e próxima mensagem, com banco de teste. Não usar clientes reais. Validar Yango real separadamente; os testes internos não encerram essa pendência.
