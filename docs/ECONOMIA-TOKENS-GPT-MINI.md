# Economia de tokens e GPT-5 mini

Pedido autorizado em 05/10/2026: reduzir conteúdo repetido e usar GPT mini.

- Modelo de atendimento: `gpt-5-mini`, Chat Completions, `reasoningEffort=low`, sem temperatura/top-p. A análise de imagem e a transcrição conservam os modelos anteriores.
- Prompt ativo: `docs/PROMPT-AGENTE-COMPACTO.md`. Regras consolidadas, sem catálogo estático repetido e sem variáveis de cliente/relógio no prefixo de instruções.
- A ficha inicial mantém todas as mensagens disponíveis, pedidos, pendências, pagamentos e geração. Mensagens são serializadas em linhas com colunas explícitas; nenhum histórico é apagado ou cortado por esta mudança.
- `consultar_cardapio` consulta famílias necessárias; todos os SKU/preços/descrições/estoques permanecem disponíveis pela consulta `todos`. Categorias desconhecidas retornam tudo, sem esconder variantes. Campos novos usam o formato completo em vez de serem descartados.
- O backend preserva a resposta antiga de `acao=catalogo`; o retorno compacto só é usado com `compacto=true`. Registro, deduplicação, comprovantes, pausa humana e pagamentos conservam suas validações.
- Testes locais: 78 testes e TypeScript. Publicação pelo script `scripts/optimize-mini-n8n.cjs`, com backup privado, teste no sandbox de expressões, consulta real somente de leitura e teste isolado do modelo. Não enviar mensagens de teste no WhatsApp.

A diminuição de tamanho da entrada não garante um percentual fixo na fatura: histórico, quantidade de chamadas a ferramentas, saída/raciocínio e cache variam. Testes determinísticos não garantem equivalência de qualidade entre modelos. Se a credencial não tem saldo, o teste de resposta do modelo permanece pendente; a configuração solicitada pode ser publicada, mas isso não reabastece créditos nem resolve pendências de atendimento.

Fontes: https://developers.openai.com/api/docs/models/gpt-5-mini e https://developers.openai.com/api/docs/guides/prompt-caching .
