# Terça-feira e antecedência de chantilly

Orientação do dono em 05/10/2026:

- Encomendas feitas com antecedência podem ser entregues na terça-feira, inclusive via WhatsApp/Yango. Preserve pedidos e acordos anteriores.
- Não aceitar nova compra pelo WhatsApp na terça para receber naquele mesmo dia. Oferecer outra data ou o PedidosYa, sem garantir disponibilidade da plataforma.
- Compras feitas na terça podem ser agendadas para quarta, conforme disponibilidade e prazo do produto.
- Bolo com chantilly exige dois dias de antecedência: compra na terça permite quinta ou depois, nunca quarta.
- Terça continua sem atendimento presencial. As duas janelas de entrega citadas pelo dono ainda não têm horários informados; registrar horário solicitado como pendente de confirmação, nunca prometer uma janela.
- Não alterar automaticamente a data de uma encomenda antiga nem repetir pedido, cobrança ou aviso.

Implementação: prompt publicado pelo script `scripts/tuesday-policy-n8n.cjs` e validação de registro no painel em `lib/agent/rules.ts`. A preservação de data existente usa o pedido consultado no banco dentro da transação, nunca um indicador enviado pela IA. As regras de pagamento continuam 100% hoje, 50% para outro dia e integral antecipado opcional.
