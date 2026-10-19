# Resolução de pendências pelo painel — 19/10/2026

O botão “Marcar como resolvida” usa resolveTicketInTransaction, compartilhada com o comando “Resolvido” no grupo. Encerra ABERTA/ASSUMIDA, preserva o histórico, suspende lembretes pelo estado e invalida a geração anterior. Resolver aviso de comprovante não confirma pagamento.

Após a transação, o painel chama a ponte n8n gula-resolver-painel, autenticada com o mesmo AGENT_API_TOKEN já usado na API. A ponte confere o cliente, a pendência resolvida, a geração e a ausência de nova pausa humana antes de remover as chaves de pausa por telefone e LID. A resolução não envia mensagem ao cliente. Falhas são mostradas no formulário; o arquivo permite repetir a sincronização sem resolver duas vezes ou liberar uma pausa humana nova.

O workflow foi criado com o builder scripts/panel-resume-workflow.cjs e está ativo como pMgs6uotBUQBnF67. GULA_RESUME_URL permite configurar outro endereço; o padrão é o webhook da instância atual. Não é necessário distribuir um novo segredo.

Limpeza única autorizada: chave owner-cleanup:2026-10-19:panel-pendencias-test-213-215. Resolve somente pendências existentes até 19/10/2026 10h15m19s UTC−4. Guarda o estado anterior e a lista de clientes para sincronização da pausa. Pedidos 213/214/215 são cancelados apenas se nome, telefone, ausência de pagamentos/vendas e estado coincidirem com a revisão. Não exclui fichas, não gera recebimento e não cancela pedidos de outros clientes. Novas pendências após o corte permanecem abertas.

Validação automatizada: resolução compartilhada e idempotente, isolamento por cliente, geração, limpeza com corte temporal, bloqueio de pedidos fora do escopo/com pagamentos e rejeição de retomada se o fluxo não confirma a liberação.
