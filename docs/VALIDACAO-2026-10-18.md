# Validação de produção: 18/10/2026

## Evidências confirmadas

- Fluxo principal ativo, timeout de 180 segundos, repetição integral do agente desativada e modelo escolhido mantido sem thinking.
- Amostra de 100 metadados de execução, entre aproximadamente 13:12 e 13:20 no horário local: 34 execuções com mais de dois segundos; 29 com uso de modelo, 45 chamadas, 551.734 tokens, máximo de seis chamadas por execução. Sem erros dos nós consultados ou repetição de assinatura de thinking. 27 envios SENT e três SUPERADA, que impedem resposta antiga após outra mensagem. Não equivale à cobrança do provedor nem valida toda a disponibilidade futura.
- Mensagem de acompanhamento enviada ao contato de teste previamente autorizado: entendeu pedido antigo, solicitou identificação, não abriu venda nem reenviou QR/cardápio. Uma chamada, 5.251 tokens, envio SENT.
- Registro real de encomenda na execução 98079 confirmado no painel como #184, total 30 Bs, retirada agendada, QR com retorno SENT. Nenhum pagamento fictício foi criado.

## Ajuste encontrado na validação

A primeira tentativa de registrar o pedido tinha preço não autorizado, foi bloqueada e depois corrigida pelo agente na mesma execução. O registro seguinte e o QR funcionaram, mas a proteção ainda considerava a primeira tentativa uma falha pendente.

O guard agora considera o resultado final de cada operação: uma tentativa corrigida não gera alerta falso. Falha posterior continua bloqueada. Aviso DUVIDA não apaga falha de COMPROVANTE. Reproduzida a sequência real 98079 contra o guard atualizado, sem alerta indevido.

165 testes automatizados passaram após esse ajuste. Incluem pagamento parcial 265/200/65, concorrência de comprovantes, preservação de mídia entre lotes, aviso pendente, deduplicação e rastreio Yango. Testes locais não são confirmação de entrega no aparelho nem consulta ao banco.

## Testes manuais seguros

Somente execução manual, telefone exato de teste previamente autorizado e nome iniciado por [TESTE] podem usar o destino alternativo do backend. Produção e demais telefones continuam usando a equipe configurada. Não criar novos workflows de teste ou pagamentos fictícios em produção.

## Aviso e rastreio integrados no fluxo existente

- Execução manual 98270: avisar_equipe retornou registrado=true, notificacaoEnviada=true e estadoEnvio=SENT para aviso de dúvida identificado como [TESTE], com destino restrito ao contato autorizado. Resposta ao cliente também SENT, sem flags de falha. Nenhuma venda ou cobrança criada.
- Execução manual 98291: resposta vinculada ao aviso com URL Yango fictícia encaminhada ao mesmo contato; enviado=true, encerrado=true e retomado=true.
- Repetido o mesmo callback na execução 98303: não reabriu a pendência. Contexto consultado na 98304 mostrou uma única mensagem de rastreio com o link de teste e pendências de teste resolvidas. O agradecimento final produziu [SEM_RESPOSTA], sem novo QR, venda ou mensagem desnecessária.
- O link de teste não representa corrida real. SENT confirma o provedor, não leitura no aparelho.

## Limites

Pagamento parcial automático com um novo comprovante ainda não foi executado em produção nesta validação, para não introduzir recebimento financeiro fictício no caixa. A lógica 265/200/65 passou nos testes automatizados; o saldo corrigido de #178 já foi conferido no painel. Rastreio foi validado integralmente com o contato e link de teste, como descrito acima. O aviso antigo do pedido #178 ainda não foi reenviado manualmente; WhatsApp Web estava desconectado.

Credenciais, conversas, comprovantes e dumps detalhados ficaram fora do GitHub.
