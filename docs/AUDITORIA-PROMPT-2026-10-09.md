# Revisão do prompt após falha de QR

Execução 39503, 09/10/2026 às 18:26 (America/La_Paz): OpenAI retornou HTTP 400 Invalid prompt, com sinalização de possível violação de política. A resposta não indica o trecho responsável; não há causa textual comprovada nem garantia de que editar o prompt elimina essa recusa.

A mensagem atual solicitava QR para pagar o restante. O contexto continha histórico de encomenda para 5 de novembro, mas `pedidos: []`. Não se conclui que o pedido não exista: o vínculo precisa ser conferido pela equipe. Nenhum registro ou pagamento foi alterado nesta auditoria.

Revisões publicadas:
- Separar pagamento de pedido existente de nova compra; não recriar pedido, inventar saldo ou fazer oferta comercial nessa etapa.
- Quando o histórico menciona pedido ausente da ficha, encaminhar conferência do vínculo com os dados conhecidos.
- Distinguir saldo de pagarAgora: pagarAgora zero não prova quitação. A ferramenta atual pode exigir ajuste do plano pela equipe para antecipar saldo.
- Remover exigência genérica de confirmação de disponibilidade que contradizia encomendas padrão futuras autônomas.
- Compatibilizar uma oferta opcional com a campanha autorizada do trio e seu complemento.
- Não reafirmar preço histórico questionado sem conferência, nem corrigir dígitos por suposição.
- Reorganizar prompt ativo na ordem do documento, preservando todas as regras não alteradas. Publicação recusaria sobreposição caso as regras ativas tivessem mudado desde a leitura.

Verificação: leitura posterior do workflow ativo confirmou prompt e preservação dos demais nós/conexões. Dez testes locais existentes de contexto, catálogo e validade da promoção passaram. Esses testes não avaliam o comportamento do modelo nem reproduzem a recusa. Nenhuma chamada OpenAI ou mensagem WhatsApp foi feita para testar.

Referência consultada: https://developers.openai.com/api/docs/guides/reasoning-best-practices (clareza e instruções diretas; não determina a causa da falha observada).
