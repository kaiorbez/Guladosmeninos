# Correção da busca do catálogo

Ocorrências de 18/10, aproximadamente 13:51 a 13:53: execuções 98722 e 98787 atingiram seis iterações consultando o catálogo. A execução 98760 tentou registrar variantes inventadas como slugs, recebeu bloqueio de preço/SKU, consultou repetidamente e não concluiu o registro.

A busca aplicava pontuação a todo o catálogo e usava descrições antes de filtrar as famílias. Combos com descrições contendo vários sabores venciam buscas de produtos avulsos. Mesmo com familias=potes, a busca podia retornar somente combos. Outro problema era reter apenas o maior número de palavras, escondendo um dos sabores de consultas compostas.

Correção: filtrar primeiro as famílias; priorizar nomes dos produtos e reter os conjuntos de termos não contidos em correspondências mais específicas, preservando vários sabores distintos. Descrições são fallback quando nenhum nome corresponde. Não substituir nem inventar SKU, preço ou estoque. Porção de torta premium de nozes passa a ser classificada como fatia; busca espanhola nuez/nueces é normalizada para nozes.

168 testes passaram, incluindo os termos reais que reproduziam as falhas e regressões de SKU, preço e estoque. Regras de atendimento humano, limites de execução e validações financeiras permanecem ativas. Prompts devem proibir consultas idênticas repetidas e uso de identificadores que não vieram do catálogo.
