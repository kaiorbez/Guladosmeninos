# Migração do painel para a Vercel

Projeto: `ceokcdigital-5021s-projects/guladosmeninos`.
Endereço de produção: `https://guladosmeninos.vercel.app`.
Código de produção: branch `main`, repositório `kaiorbez/Guladosmeninos`.

## Banco e configurações

O PostgreSQL permanece no Railway; a migração do painel não copia pedidos nem
pagamentos. O proprietário autorizou habilitar o proxy TCP público do banco,
com senha e SSL, em 22/10/2026. A conexão foi validada consultando `pg_stat_ssl`:
`ssl=true`. Usar `sslmode=require`, `connection_limit=1`, `pool_timeout=30` e
`connect_timeout=15` na conexão externa de produção. Não publicar a URL ou senhas.

Variáveis somente no ambiente Production: `DATABASE_URL`, `AUTH_SECRET`,
`AGENT_API_TOKEN`, `GULA_MENU_URL`, `GULA_QR_URL`, `WHATSAPP_EQUIPE`,
`ZAPI_CLIENT_TOKEN`, `ZAPI_INSTANCE`, `ZAPI_TOKEN`, `GULA_RESUME_URL`.
Preview não recebe credenciais de produção. Usuários existentes permanecem no
mesmo banco; não é necessário replicar a senha inicial de administrador.

`vercel.json` define Next.js, região `sfo1` e limites das funções.
O build executa geração do Prisma e compilação, sem `db push`, seed ou alterações
de dados. Futuras mudanças de esquema exigem uma aplicação controlada separada.

## Troca e conferência

1. Construir instalação com as variáveis de Production e domínio ainda não promovido.
2. Confirmar acesso com SSL ao mesmo banco, login, bloqueio de acesso sem sessão
   e rejeição de chamadas da IA sem token.
3. Promover a instalação validada ao domínio de produção.
4. Conferir catálogo, pedidos, pagamentos e telas por leitura. Não enviar mensagens
   reais ou criar cobranças para testar a mudança de hospedagem.
5. Fazer backup dos workflows atuais do n8n e trocar apenas referências ao host
   antigo pelo novo. Preservar prompts, credenciais, conexões e estado ativo.
   `scripts/panel-host-n8n.cjs` aplica essa transformação de forma idempotente.
6. Conferir também o fluxo autenticado de liberação das pendências e rotinas diárias.

O serviço antigo do Railway continua disponível para reversão. Uma reversão deve
restaurar os endpoints dos backups dos workflows, sem restaurar cópias antigas do
banco. Os dois painéis compartilham as mesmas chaves de deduplicação no PostgreSQL.
