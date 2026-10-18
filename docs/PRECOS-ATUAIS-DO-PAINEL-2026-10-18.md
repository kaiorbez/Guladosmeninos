# Preços atuais do painel e cobranças sem registro

Auditoria solicitada em 18/10: intervalo 13:45:28 a 14:45:28 no horário local. Foram indexadas 1.171 execuções, com 419 candidatas de duração >=1 segundo ou erro. Logs detalhados e dados de clientes ficaram somente no diretório local.

Foram identificadas respostas sem consulta de catálogo no turno que informavam porção avulsa de maracujá a 35 Bs, enquanto o painel indicava 30 Bs. Resumos posteriores repetiam o valor errado e prometiam QR sem gravação de pedido. O preço histórico não é fonte autorizada para nova oferta.

Correções:

- Ficha compacta passa a incluir tabela de preço/estoque/SKU atuais do painel para famílias identificadas na conversa recente. Sem descrições longas e sem envio do catálogo inteiro quando não é necessário. Histórico é preservado para acompanhamento, mas seus preços não prevalecem sobre o painel.
- Antes do envio de mensagem com valores em Bs, o backend confere citações inequívocas de preço avulso de fatias/potes no catálogo atualizado. Divergência é bloqueada, pendência registrada para revisão do resumo e cliente recebe o preço atual em vez do incorreto. Não recalcula total ambíguo, frete, promoção ou pagamento automaticamente; não altera contratos ou recebimentos antigos.
- Prometer QR sem ficha existente nem registro confirmado gera pendência, sem anunciar cobrança realizada.
- Prompt reforça fonte do WhatsApp no painel, nunca memória, histórico, preço fixo de exemplo ou preço PedidosYa. Fonte de status de encomenda já contratada continua sendo a ficha da encomenda.

177 testes passaram na implementação inicial, incluindo maracujá em espanhol por 35 versus 30, preços por família, preservação de total/frete/promoção, valor atualizado no prompt e promessa de QR sem registro. Verificações automatizadas e guard conservador não substituem análise de textos ambíguos.
