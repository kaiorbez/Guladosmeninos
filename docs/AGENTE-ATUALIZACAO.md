# Integração do atendimento com o painel

Esta versão adiciona encomendas pendentes, histórico, dúvidas rastreáveis e envios idempotentes. O JSON `n8n/agente-gula-v2.json` depende da API `POST /api/agente/operacoes`. Não substitua o fluxo ativo antes de publicar o painel, configurar suas variáveis e vincular as credenciais dos nós importados.

## Configuração no Railway

No serviço Guladosmeninos, manter `DATABASE_URL`, `AUTH_SECRET` e `AGENT_API_TOKEN` existentes. Acrescentar:

- `ZAPI_INSTANCE`: campo `ZAPI_INSTANCIA` do nó Parametros Fluxo atual.
- `ZAPI_TOKEN`: campo `ZAPI_TOKEN` do mesmo nó.
- `ZAPI_CLIENT_TOKEN`: valor de `Client-Token` da credencial Z-API Gula.
- `WHATSAPP_EQUIPE`: identificador exato do grupo já configurado no fluxo.
- `GULA_MENU_URL`: URL_CARDAPIO do fluxo atual.
- `GULA_QR_URL`: URL_QR_BOLIVIA do fluxo atual.

Não colocar valores secretos no GitHub. O start existente executa `prisma db push`; revisar o plano de alteração antes do deploy. A mudança é aditiva (tabelas Agent* e campos em Order) e não inclui migração de vendas históricas para encomendas.

## Configuração no n8n

O JSON do repositório está desativado e sem segredos/credenciais. Preservar o caminho do webhook de produção, os parâmetros da loja e as credenciais atuais de OpenAI, Redis e Z-API. Nos novos nós que acessam `/api/agente/operacoes`, usar a credencial do painel: cabeçalho Authorization, valor Bearer seguido de AGENT_API_TOKEN. Não usar a chave pública do n8n.

Importar também `n8n/lembretes-painel.json`, configurar PAINEL_URL e a mesma credencial. Ele verifica a cada dois minutos os avisos vencidos há dez minutos, com no máximo três lembretes. Não manter simultaneamente o lembrete antigo para as mesmas pendências.

Publicar primeiro o painel; confirmar autenticação e leitura da API; testar uma cópia isolada do fluxo e só então atualizar o fluxo ativo. Uma resposta 401 sem chave confirma apenas a proteção da rota, não a saúde do banco ou a configuração da Z-API.

## Comportamento

- Data de entrega hoje em America/La_Paz: 100% à vista. Data futura: sinal de 50%, ou integral a pedido do cliente. Pagamento confirmado é descontado.
- `pedido` cria Order com paid=0, sem lançar receita ou baixar estoque. Alterações usam id, telefone e versão. Ações financeiras permanecem com a equipe.
- `pendencia` salva a dúvida mesmo se a notificação ao grupo falhar. O painel mostra avisos e envios sem confirmação.
- “Respondido”/“Resolvido” em resposta ao aviso libera a IA para a próxima entrada. Link HTTPS de delivery.yango.com/route/ é encaminhado ao cliente associado; encerramento ocorre após confirmação de envio.
- Mensagens repetidas são identificadas pelo ID. Cada lote pronto é consumido uma vez. Antes de responder/cobrar/registrar, a geração da conversa é verificada para evitar ações ultrapassadas por uma nova mensagem.
- SENDING/UNKNOWN não são reenviados automaticamente: a equipe deve conferir o WhatsApp para evitar duplicação após um timeout.
- Texto/localização/mídia antiga não autorizam ticket de comprovante. A leitura da imagem ainda depende do modelo e não comprova autenticidade ou liquidação bancária.

## Validação e limites

Executar `npm test`, `npm run typecheck` e `npm run build`. Os testes usam banco simulado e transporte simulado; não substituem teste de integração com PostgreSQL e um contato de teste autorizado. Não enviar testes para clientes reais.

O histórico importado é limitado às últimas 100 mensagens disponíveis na Z-API. A ficha consulta até 100 pedidos e 20 pendências. Não há recuperação de áudios/imagens históricos nem garantia de acesso a toda conversa antiga. Pedidos antigos cujo telefone foi salvo com outra formatação exigem normalização/conferência antes da migração. Não prometer ausência absoluta de alucinações: o prompt e os controles reduzem riscos, e informações sem evidência devem ir para a equipe.

Em 03/10/2026 foi publicada uma correção compatível no fluxo K5M9CtCwpIC3LdQ7 do n8n empresativadigital.work: contexto, pagamento por data, proteção de comprovante, retomada por resposta da equipe, Yango e eliminação de menu automático. A integração completa desta pasta é uma etapa separada. O lançamento automático pela API legada de vendas foi suspenso porque ela contabiliza venda/estoque e não representa encomenda pendente.
