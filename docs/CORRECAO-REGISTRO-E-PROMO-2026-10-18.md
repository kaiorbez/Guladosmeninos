# Correções de registro e acompanhamento

Causas observadas em produção em 18/10:

1. Pedido #197 já registrado e comprovante processado com aviso enviado: o agente tentou depois salvar os mesmos itens com IDs inventados. A tentativa foi bloqueada corretamente, mas gerou alerta desnecessário. SaveOrder passa a tratar repetição exata de ficha, versão e cliente como leitura sem alteração. Mudança real de item, quantidade, preço, endereço ou versão continua sujeita às validações. Não altera pagamentos nem cria pedido.
2. A promoção de duas fatias de Ninho com frutas vermelhas existia, mas nomes iniciados por Promo eram classificados em adicionais. A busca por kits/fatias não conseguia encontrá-la, levando ao limite de iterações. Promo/oferta passa à família kits e promoção de fatias também é localizável em fatias. Mantidos preço e SKU reais.
3. Pedido #192 já existia. A saudação de acompanhamento recebeu resposta de status, mas o guard exigia gravação neste turno para qualquer frase pedido registrado. Agora uma saudação e uma única ficha pendente no contexto autenticado permitem descrever o registro existente. Nova compra, ausência de ficha ou falha efetiva de ferramenta continuam gerando proteção.

Prompt reforçado: comprovante de ficha existente usa avisar_equipe e não registrar_encomenda para repetir itens ou atualizar pago. Retorno de execução superada exige parar, sem novas consultas ou tentativas. Pausas humanas preservadas.

Regressões cobrem promoção em kits/fatias, repetição de ficha com pagamento preservado e status de pedido existente. Não presumir que um alerta de ferramenta equivale à inexistência da venda: conferir a ficha antes de corrigir ou criar outra.
