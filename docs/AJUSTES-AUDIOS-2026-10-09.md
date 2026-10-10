# Orientações dos áudios de 09/10/2026

Aplicadas em 10/10, mantendo o modelo Luna e as conexões de produção.

- A referência citada acompanha o texto atual no lote da IA, inclusive quando há análise de mídia. Legenda de anúncio pode identificar o produto, mas não comprova o conteúdo visual.
- Pergunta em resposta ao Kit Fiesta é atendida como kit. Consultar os três tamanhos e seguir com horário, dados e fechamento, sem desviar para bolo avulso.
- Promoção complementar somente após encaminhar a compra principal. Uma oferta, sem insistência.
- Proprietário confirmou que a troca premium vale para Perfecto e trio. Acréscimo de 5 Bs por pote substituído, com sabores completos e disponibilidade consultados no catálogo.
- Variantes cadastradas: Perfecto premium 50 Bs; trio com 1/2/3 premiums 55/60/65 Bs. Valores básicos continuam 45/50 Bs. Validade do trio permanece 09 a 11/10.
- Quitação antecipada usa `quitarSaldo=true` apenas a pedido expresso. Atualiza o plano de cobrança, não o dinheiro recebido; preserva saldo, total e proteção contra geração antiga e cobrança duplicada.
- Aviso de falha inclui etapa e texto realmente recebido, sem inferir conteúdo de mídia nem expor erro bruto.
- Vínculo da encomenda 24 corrigido no painel. Data e pagamentos preservados; consulta de contexto confirmou saldo zero. Não houve novo QR para essa cliente.

## Verificação

112 testes locais aprovados e TypeScript sem erros. Testes isolados com Luna cobriram anúncio de kit, trio com dois premiums, Perfecto premium, quitação antecipada e pedido de QR sem vínculo. Ferramentas comerciais foram substituídas por respostas simuladas; nenhum WhatsApp foi enviado e nenhum pedido de produção foi alterado por esses testes.

Os primeiros testes revelaram oferta precoce e um encaminhamento desnecessário no Perfecto; a regra foi esclarecida e o cenário repetido com sucesso. Um critério de teste também foi corrigido para aceitar “horário” com acento. Testes de modelo validam os cenários observados, não garantem comportamento perfeito em toda conversa.

Deploy confirmado no GitHub/Railway. Workflow ativo relido após publicação; catálogo e vínculo conferidos por consulta de leitura ao painel. Workflows temporários removidos.
