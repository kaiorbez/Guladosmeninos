# Tarifa no acompanhamento Yango

Ao receber o link em uma resposta vinculada ao aviso, o backend consulta o mesmo endpoint público usado pela página de acompanhamento Yango: POST https://ya-authproxy.yango.com/4.0/cargo-c2c/v1/shared-route/info, com a chave UUID do fragmento. A consulta não exige conta e não gera corrida ou cobrança.

O extrator aceita apenas valores em Bs/BOB rotulados Precio, Price ou Preço nos detalhes da entrega. Não usa números do link, valores do pedido, anúncios, endereço ou estimativas. Valores ambíguos, link expirado, erro ou timeout de 8 segundos retornam tarifa indisponível. A tarifa explicitamente informada pela equipe continua como alternativa; sem nenhuma fonte, encaminha o acompanhamento sem inventar valor.

O valor consultado aparece como “Valor da entrega: 8 Bs.” ou “Costo del envío: 8 Bs.”, preservando idioma e encerramento. É registrado no evento do envio e não altera pagamento, saldo ou faturamento da encomenda. A mesma chave de envio continua evitando links duplicados.

Verificação real de leitura em 04/10/2026: o link fornecido pela pessoa usuária apresentou Precio Bs8 e status Entregado. Nenhuma mensagem de teste foi enviada. Testes simulados cobrem extração, fontes indevidas, ambiguidade, timeout, host inválido, tarifa automática e preservação financeira.
