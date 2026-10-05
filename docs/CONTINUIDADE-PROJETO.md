# Continuidade do projeto Gula dos Meninos

Atualizado em 04/10/2026. Documento de passagem para continuar em outro computador. Não é uma transcrição integral do chat. Distingue regras desejadas, implementações e pendências; confirme o estado ao vivo antes de alterar produção.

## Começar no Windows

1. Acesse `kaiorbez/Guladosmeninos`, branch `codex/gula-agent-reliability`. Não presuma que a branch padrão tem estas alterações.
2. Leia este documento, `docs/PROMPT-AGENTE-2026-10-04.md`, o README, `lib/agent/`, as rotas `app/api/agente/`, `prisma/schema.prisma` e os testes.
3. Consulte o fluxo ativo do n8n e suas execuções. O GitHub não sincroniza automaticamente alterações feitas no editor do n8n. Arquivos em `n8n/` precisam ser comparados com a versão ativa antes de importar.
4. Configure os acessos pelos serviços/gerenciador de credenciais. Tokens e scripts temporários do Mac não estão neste documento e não devem ser copiados para o GitHub.
5. Priorize as pendências críticas abaixo. Não reinicie o projeto nem substitua o prompt por um resumo que retire regras essenciais.

Sugestão de mensagem para o novo agente:

> Continue o projeto kaiorbez/Guladosmeninos na branch codex/gula-agent-reliability. Leia docs/CONTINUIDADE-PROJETO.md e docs/PROMPT-AGENTE-2026-10-04.md. Verifique o estado ativo no n8n/Railway e resolva primeiro as pendências críticas. Preserve regras de pagamento, contexto, tom, emojis, upsell, localização, avisos estruturados e proteção contra duplicações. Informe o que foi realmente testado.

## Arquitetura e ambientes

| Componente | Local / função |
| --- | --- |
| Código | GitHub `kaiorbez/Guladosmeninos`, branch `codex/gula-agent-reliability` |
| Painel e API | https://guladosmeninos-production.up.railway.app |
| Banco | PostgreSQL no mesmo projeto Railway; clientes, encomendas, pagamentos, eventos, fila e histórico |
| n8n de produção | https://n8n.empresativadigital.work |
| Fluxo principal | `K5M9CtCwpIC3LdQ7`, atendimento Gula |
| Webhook Z-API | `https://webhook.empresativadigital.work/webhook/gula-atendimento` |
| Lembretes | Workflow `z19kouzCSA43r4Ak` |
| Falhas técnicas | Workflow `uuQcIxlNcHsv09mn`, configurado como errorWorkflow do principal |
| WhatsApp | Z-API; transporte centralizado no backend e credenciais próprias nos nós legados |
| IA | OpenAI no n8n; imagem usa gpt-4o-mini na credencial `OpenAi account` |

Última versão funcional diagnosticada antes desta documentação: `gula-historico-recuperado-v17`; commit de código `6e6dd7354654344c963de5a69de872320214bb21`. O commit desta documentação será posterior. Railway estava conectado à branch acima com deploy automático; confirmar na interface.

Variáveis necessárias no Railway: `DATABASE_URL`, `AUTH_SECRET`, dados administrativos, `AGENT_API_TOKEN`, `ZAPI_INSTANCE`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `WHATSAPP_EQUIPE`, `GULA_MENU_URL`, `GULA_QR_URL`. Valores ficam exclusivamente nos serviços.

Credencial n8n `Painel Gula API`: chamadas ao painel, não à Z-API. Credencial Z-API: header Client-Token de chamadas diretas à Z-API. Não intercambiar. Quando mudar Client-Token, atualizar os locais realmente usados, incluindo Railway. Exportar JSON não transfere os valores secretos das credenciais nem o banco de dados.

## Pendências críticas reais

### Continuação local no Windows em 04/10/2026

Implementado o contrato `falhaAnalise` no backend, com pendência durável, resposta sem OpenAI, deduplicação e proteção por geração. Integração e limites: `docs/FALHA-ANALISE.md`. Ainda não publicado nem conectado ao fluxo ativo. O conector n8n retornou workflow inexistente/sem permissão para `K5M9CtCwpIC3LdQ7`; portanto não foi possível confirmar o estado ativo nem as execuções reais. Yango real, saldo OpenAI, Railway e testes de envio continuam pendentes.

### 1. API OpenAI sem saldo e cliente sem resposta

Verificado em 04/10/2026 nas execuções `1428097` (12:59 local) e `1428106` (13:00): foto de bolo com pergunta em espanhol sobre preço; depois pergunta sobre quantidade de pessoas. Não publicar dados do cliente.

`Analisar Imagem` falhou com HTTP 429, `credit_balance_exhausted`, `insufficient_quota` e mensagem de saldo esgotado. Não confundir com limite transitório de requisições. A segunda execução retornou `processar:false`, aguardando a mídia não analisada. Recarga da API depende do titular da conta. ChatGPT pago não substitui saldo da API.

**Ainda não corrigido:** tratamento imediato dessa falha para evitar silêncio e fila presa. O nó de imagem observado não tem saída de erro configurada. Existe workflow de falha técnica, mas sua presença não comprova aviso entregue nem recuperação da conversa.

`prepare()` em `lib/agent/service.ts` marca mídias pendentes há mais de 10 minutos como conteúdo indisponível, porém só quando outra chamada de preparação ocorre. Isso não é um temporizador autônomo e não garante retorno se ninguém escrever novamente.

Próxima implementação: tratamento idempotente da falha de imagem/áudio/IA, retorno seguro sem inventar conteúdo e pendência para equipe/painel mesmo sem OpenAI. Avaliar também recuperação da fila após recarga; não executar replay irrestrito de callbacks ou pagamentos. Verificar geração atual, resposta humana, pedido existente e mensagens já enviadas antes de retomar.

### 2. Yango precisa de validação real final

Encaminhamento e deduplicação passaram em teste interno. Resposta real `Respondido` no grupo foi processada. Ainda falta registrar evidência de evento real com link Yango respondendo ao aviso, chegando uma única vez ao cliente e encerrando a pendência. Não afirmar que esta etapa está 100% validada.

### 3. Histórico é parcial

Consulta tentada à Z-API para mensagens antigas retornou 400. Histórico recuperado de execuções retidas não é todo o WhatsApp. Não afirmar conhecimento de acordo antigo ausente; consultar equipe quando necessário.

## Regras de negócio essenciais aprovadas

- Tom animado e natural, PT ou ES conforme texto do cliente, emojis moderados. Não decidir idioma pelo DDI. Evitar travessões nas respostas ao cliente. Não precisa mencionar que o horário é de Santa Cruz.
- Consultar histórico, encomendas e pagamentos antes de responder. Pedido feito anteriormente é acompanhamento; não começar outra venda automaticamente.
- Confirmar data do pedido quando ausente, distinguindo hoje de outro dia. Para hoje, pagamento integral de 100%. Para outro dia, sinal de 50%, permitindo pagamento integral antecipado.
- Toda encomenda pelo WhatsApp deve ser registrada no painel. Não anunciar agendamento confirmado se o registro falhou. Pedido imediato deve ter indicação AGORA sem inventar horário/ETA.
- Comprovante só existe com mídia real atual analisada; localização, QR de cobrança, foto de bolo e mensagem de texto não são comprovantes.
- Comparar valor devido, moeda, beneficiário, banco e data. Pela política solicitada pelo usuário, comprovante compatível registra pagamento e recebe mensagem curta de preparo. Não dizer ao cliente que os dados conferem. Divergência/ilegibilidade vai para equipe e painel.
- Leitura de comprovante não é conciliação bancária; não inventar acesso à conta ou autenticidade. Para encomenda futura, não prometer preparo imediato fora da programação.
- Aproveitar localização nativa/coordenadas/link existente e pedir apenas complemento ausente. Não pedir o mesmo endereço novamente.
- Oferecer adicional opcional uma vez antes do QR: empadão com Coca, bolo com cobertura/adicional compatível conforme catálogo. Não insistir, não tornar compra dependente do adicional e não repetir upsell em acompanhamento de pedido antigo.
- Sabores e preços vêm do cardápio/catálogo. Distinguir produto listado de estoque disponível naquele momento. Orçamento personalizado sem preço cadastrado exige equipe, com aviso e pendência reais.
- Segunda e quarta: 14:00 a 20:00. Quinta a domingo: 10:00 a 21:00. Fuso interno America/La_Paz.
- Terça: entregas de encomendas feitas antecipadamente são permitidas, inclusive WhatsApp/Yango; bloquear somente nova compra na própria terça para o mesmo dia. Compras na terça podem ir para quarta, exceto chantilly, que exige dois dias e vai para quinta ou depois. Sem atendimento presencial; duas janelas de entrega ainda sem horários confirmados. Não alterar compromisso anterior confirmado sem equipe. Ver `docs/TERCA-E-CHANTILLY.md`.
- Economia (05/10): atendimento com GPT-5 mini e prompt `docs/PROMPT-AGENTE-COMPACTO.md`; catálogo por ferramenta de consulta/famílias, histórico e pedidos preservados. Ver `docs/ECONOMIA-TOKENS-GPT-MINI.md`. Não restaurar prompt anterior extenso nem remover a ferramenta `consultar_cardapio` sem reavaliar esta integração. Trocar modelo não adiciona saldo OpenAI.
- Fora de horário: explicar, oferecer próxima abertura e perguntar se serve. Não prometer entrega sem confirmação. Lembretes para equipe devem respeitar horário.
- PedidosYa: https://www.pedidosya.com.bo/restaurantes/santa-cruz-de-la-sierra/gula-dos-meninos-99bca082-3bd8-4f9f-a829-c1c2c6350c0e-menu

## Avisos de grupo e retomada

Padrão visual: cabeçalho `🔔 *GULA — AVISO DO AGENTE*`, separador `━━━━━━━━━━━━━━━`, tipo do aviso, cliente/link, resumo, pedido, total/pagar agora, comprovante quando aplicável, entrega/retirada, ação da equipe. Blocos separados por linhas vazias.

- Evitar aviso de venda e outro repetido de pagamento para o mesmo evento; pagamento compatível não deve permanecer como comprovante pendente nem gerar pedidos repetidos de verificar.
- Dúvida real deve criar pendência no painel e avisar grupo. Falha de envio não equivale a aviso entregue.
- Equipe responde ao **aviso do agente vinculado ao cliente** com `Respondido`/`Resolvido`: resolve pendência e permite retomada nas próximas mensagens.
- Equipe responde ao aviso vinculado com link `https://delivery.yango.com/route/...`: backend identifica cliente, encaminha uma vez e só encerra após envio confirmado. Resposta a mensagem sem vínculo não deve ser encaminhada ao cliente errado.
- Na Z-API, `Ignorar mensagens de grupos` estava ativado e foi desativado; eventos de mensagens próprias habilitados. Confirmar após qualquer mudança da instância.

## Implementações já publicadas

- API de agente integrada ao painel para ficha/contexto, entrada, conteúdo, preparação de lote, pedidos, pendências, pagamentos e envio.
- Persistência de fila e eventos com IDs, bloqueio por conversa, controle de geração e deduplicação. Mensagem humana pausa o agente; geração antiga não deve enviar resposta atrasada.
- `sendOnce` registra tentativa antes de enviar e distingue SENT/FAILED/UNKNOWN/SUPERADA. Não repetir cegamente envio de resultado desconhecido.
- Pagamento por comprovante ligado ao pedido e mídia; repetição não deve criar outro pagamento/venda.
- Vínculo de telefone boliviano legado de 8 dígitos ao formato internacional 591 preservando o mesmo pedido e saldo.
- Bloqueio de reenvio do mesmo QR como se fosse novo quando cliente relata problema; encaminha dúvida à equipe. Não inventar conta alternativa.
- Detecção de algumas frases de agendamento confirmado sem pedido salvo; substitui por solicitação pendente e registra dúvida. Não cobre necessariamente todas as paráfrases.
- Recuperação de histórico administrativo sem disparar ações comerciais.

Casos de pagamentos e horários inconsistentes foram tratados, mas correção de um registro não prova ausência de falha futura. Validar os mecanismos, não apenas a aparência da ficha.

## Histórico recuperado e limites

Fonte: callbacks reais de conversas individuais em 1369 execuções disponíveis do fluxo principal. Recuperadas 731 mensagens de 41 contatos, entre 03/10/2026 11:22:08 e 04/10/2026 13:00:03 locais. Foram adicionadas 636 entradas novas; 95 já existiam e não foram duplicadas. Grupos, contato de teste e textos apenas gerados pela IA foram excluídos.

Não foram enviados WhatsApps, criados pedidos ou registrados pagamentos por essa importação. Conteúdo antigo de imagens/áudios/documentos não disponível fica explicitamente ausente. `historicoRecuperadoN8n` e `historicoParcial` indicam esse estado. Contexto automático limitado às 100 mensagens mais recentes e 100 pedidos; registros históricos permanecem no banco.

Arquivos centrais: `lib/agent/recovered-history.ts`, `app/api/agente/historico/route.ts`, `tests/recovered-history.test.cjs`. Rota de importação é administrativa e protegida, não uma ferramenta comercial para a IA. Pontes temporárias usadas no Mac foram desativadas.

## Verificação e sequência de testes

Última verificação registrada na v17: 49 testes automatizados passaram e TypeScript passou. Esta documentação não representa novos testes de envio.

Após instalar dependências em ambiente de desenvolvimento:

```sh
npm ci
npm test
npm run typecheck
```

Use banco local/de teste. Não rodar seed, limpeza ou migração destrutiva no banco real para preparar testes. No Windows, consultar comandos do README; o start atual contém expressão de shell Unix e o comando de produção do Railway deve ser preservado.

Antes de declarar atendimento pronto, testar:

1. Texto e foto com saldo OpenAI disponível, e erro controlado sem saldo, sem deixar fila silenciosa.
2. Comprovante compatível, divergente, repetido, ilegível, QR e localização; pagamento único e saldo atualizado no painel.
3. Encomenda hoje/futura, acompanhamento antigo e pedido imediato com localização já recebida.
4. Fora de horário e terça, incluindo lembretes que não cobram equipe fechada.
5. Resposta humana durante geração; nenhuma resposta atrasada ou duplicada.
6. Respondido/Resolvido e Yango reais vinculados ao aviso correto, envio único e encerramento.
7. QR/cardápio por imagem/documento; falha de transporte não anunciada como sucesso.

Solicitar/confirmar destino próprio de teste no novo ambiente. Não usar clientes reais para mensagens de teste. Não publicar logs financeiros, telefones de clientes, comprovantes, .env, tokens, callbacks ou exports sem saneamento.

## O que não está no GitHub

A conversa completa do Codex, capturas/comprovantes privados, arquivos temporários do Mac, credenciais e banco de produção. O prompt anexado é uma fotografia documentada da versão publicada anteriormente; confirmar o texto atual no nó Agente Gula antes de substituir. Operações locais antigas não devem ser reproduzidas como instruções de execução.

Correção de 05/10/2026 após execução 8124: GPT-5 mini confundiu 22:59 UTC do histórico com 18:59 no horário da loja, apesar de estadoAtendimento indicar aberto. Retornado ao GPT-5.2 por solicitação do usuário. Contexto passa a começar pelo relógio oficial explícito; próxima abertura fica nula enquanto aberto. Transporte elimina travessões/meia-risca das mensagens ao cliente, mantendo links e avisos internos. 80 testes e TypeScript passaram; nenhum envio de teste ao WhatsApp. Redução de texto não comprova equivalência de qualidade entre modelos.
