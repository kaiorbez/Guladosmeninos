# Contexto compacto do agente — 04/10/2026

Aplicado no n8n da VPS ao campo de mensagem do nó Agente Gula. As instruções de sistema, modelo, ferramentas, conexões e regras do backend foram preservados.

O catálogo completo é agrupado pelos campos comuns produto, descrição, controle de estoque e preço sob consulta. Variantes aparecem em linhas com colunas explícitas variantId, tamanho, preço e estoque. Nenhuma variante é filtrada. Caso surjam campos novos no catálogo, a função mantém o formato original para não descartá-los. Histórico, pedidos, pendências, pagamentos, geração e localização permanecem íntegros. A mensagem atual é enviada uma vez, fora da ficha, evitando duplicação.

Fonte: lib/agent/prompt-context.ts. Implantação: scripts/compact-n8n-context.cjs. O script exige credencial local fora do Git, valida equivalência dos dados nos contextos retidos, salva backup privado fora do repositório, atualiza apenas o campo text, publica e compara o campo salvo e o prompt de sistema original.

Verificação inicial: seis contextos reais, todos com 183 variantes; a mensagem/ficha caiu aproximadamente 20% a 26% em caracteres. O prompt de sistema ainda tem cerca de 42 mil caracteres. Percentual não equivale à economia de tokens ou custo total; estes precisam ser medidos nas próximas chamadas. Não foi prometida igualdade absoluta de comportamento de um modelo probabilístico. A estratégia preserva todos os dados e regras e reduz somente repetição na representação.

Testes de preservação cobrem IDs, preços, estoques, descrições, histórico, pedidos, campos novos e catálogos vazios. Não reduzir histórico, trocar modelo, retirar regras ou implantar consultas seletivas sem avaliação específica. Reverter pelo campo text do backup local, mantendo as demais alterações posteriores do workflow.

Validação no n8n: a primeira tentativa foi bloqueada por acesso a prototype; foi corrigida. A inspeção isolada também identificou incompatibilidade de Map/iterador, substituído por arrays. O script agora valida o resultado no sandbox real em workflow temporário, removido ao terminar, antes de publicar. A pendência técnica criada no contato de teste foi resolvida pelo aviso vinculado. Execução 162 retornou a resposta correta em espanhol sobre segunda-feira, com envio confirmado SENT. 59 testes e TypeScript passaram. Só os três workflows permanentes permaneceram ativos.
