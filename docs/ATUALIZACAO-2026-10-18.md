# Atualização operacional de 18/10/2026

Produção: branch `codex/gula-agent-reliability`. Painel hospedado no Railway.
Fluxo n8n ativo: `q2JCUkaCkX6Ab0Wg`, no servidor HostGator atual.

## Correções publicadas

- Comprovante real, analisado e com até dez minutos permanece disponível quando uma mensagem complementar inicia outro lote. O vínculo exige evento de entrada, mesmo telefone, imagem/PDF e URL original; foto de produto ou texto isolado não viram comprovante.
- Comprovantes que já produziram pagamento não são reaproveitados. A chave do aviso usa o vínculo da mídia, evitando outra notificação pela mesma imagem em uma nova geração. As proteções de geração e pausa humana continuam ativas.
- Falha das ferramentas de registro/aviso não pode virar falsa confirmação ao cliente: o fluxo envia os resultados ao backend, que registra pendência e tenta avisar a equipe com deduplicação. Um aviso cujo envio não foi confirmado não é anunciado como enviado.
- Prompt reforça registro do pedido aceito antes da cobrança e pagamento futuro entre o sinal mínimo e o saldo. Exemplo de regressão: total 265, recebimento 200, saldo 65. Hoje continua exigindo 100%.
- Aba e atalho Pedidos de hoje. Ordenação de pendentes acontece antes da paginação: AGORA por primeiro pagamento positivo, depois agendados por horário, depois sem horário. Pedidos da IA sem pagamento continuam na aba Aguardando pagamento.

## Consumo de tokens e disponibilidade

Duas execuções antigas fizeram centenas de chamadas repetidas, alternando sucesso com erro de assinatura de bloco thinking vinculado a outra conversa. Somadas: 21.841.090 tokens. A auditoria dos dias 16 a 18, parcial até aproximadamente 11:31 do dia 18, encontrou pelo menos 41.775.466 tokens. Esses números não equivalem à cobrança nem distinguem todos os descontos de cache.

Mantido Claude Sonnet 5.5 escolhido pelo responsável, com thinking desativado, sem repetição integral automática do agente e timeout de execução de 180 segundos. Execução posterior observada: uma chamada de modelo, sem erro, resposta SENT. Falhas de saldo de créditos anteriores não são confundidas com pausas legítimas de atendimento humano.

## Validação

Build de produção e verificação de tipos concluídos. 163 testes locais passaram, incluindo persistência, concorrência, comprovante seguido de texto, pagamento parcial e pendência por falha de ferramenta. Nova fila conferida visualmente no painel publicado.

Não se deve alegar consulta ao banco, recebimento de mensagem pelo aparelho ou ausência absoluta de futuras falhas. Status SENT é confirmação do provedor. Testes de mensagem autorizados usam apenas o número de teste previamente autorizado; não criar novos workflows de teste. Não reativar lembretes aposentados nem retirar pausas humanas em massa.

## Continuidade

`n8n/response-result-guard.js` é o código do nó Conferir Resposta e Resultados. O nó Enviar Mensagem WhatsApp também envia `falhasFerramentas` e `idioma` ao backend. O backend precisa estar publicado antes de habilitar esses campos. A versão efetivamente ativa deve ser consultada no n8n; JSONs históricos do repositório não são cópias autoritativas da produção.

Logs, comprovantes, tokens e backups de produção ficaram fora do GitHub.
