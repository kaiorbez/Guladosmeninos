# Auditoria do agente, 8 de outubro de 2026

## Escopo e evidências

Revisão do código do painel, instruções e grafo do n8n, configurações publicadas e execuções anteriores. Foram consultados metadados de 2.000 execuções e detalhes de 60 execuções recentes selecionadas por duração/erro. Nenhuma dessas 60 apresentou erro técnico de nó; isso não significa que todas as respostas comerciais estavam corretas. A amostra inclui versões anteriores às correções.

Não foram feitas chamadas novas à OpenAI, enviados WhatsApps de teste ou alterados pedidos/pagamentos reais. Testes locais usam banco e transporte simulados. Não constituem homologação integral da Z-API, banco de produção ou comportamento do modelo.

## Correções desta continuação

1. Retomada confirmada pela equipe passa a limpar também a pausa Redis do telefone e do LID conhecido. Antes, o painel podia liberar enquanto o n8n continuava bloqueando.
2. Mapeamento reverso telefone/LID passa a ser atualizado em entradas novas com LID, inclusive durante pausa, sem sobrescrever com valor vazio.
3. Reset dos números de teste autorizados passa a ser alcançável durante pausa; callbacks duplicados continuam barrados. O painel consome o buffer, libera pausa e invalida a geração antiga. Histórico, pedidos e pagamentos são preservados.
4. Repetir a resolução de um aviso já resolvido não libera uma pausa humana posterior nem incrementa novamente a geração.
5. Confirmação de preparo e envio confirmado do Yango passam a informar a retomada ao n8n. Falha de envio não libera atendimento.

Uma alteração candidata que faria callback humano antigo assumir pendência nova foi rejeitada por teste e retirada antes da publicação.

## Matriz da revisão

| Área | Evidência / resultado |
|---|---|
| Registro no painel e QR | Testes de registro, preço autorizado, geração, duplicação e pedido antes do QR. Venda padrão de quatro itens/115 Bs passa sem pendência humana. |
| Pagamento e comprovantes | Testes de moeda, beneficiário, banco, data, valor devido, mídia atual e idempotência; 100% hoje, 50% futuro ou integral antecipado. Leitura não comprova crédito bancário. |
| Mídias e falhas | Rotas de erro de IA, imagem e áudio presentes; localização/QR/foto de referência não devem virar comprovante. Falha persiste para revisão, sem inventar conteúdo. |
| Contexto e pedidos antigos | Testes de histórico, identificação internacional, reaproveitamento de dados e proteção de pedido existente. A exatidão dos 41 históricos importados não foi revalidada contato a contato. |
| Pausa e mensagens atrasadas | Geração, pausa do painel e Redis verificadas; callback humano antigo e duplicado continuam sem assumir pendência nova. Correção adicional de retomada nesta auditoria. |
| Avisos e equipe | Dúvidas imediatas, aviso vinculado, resposta livre assume atendimento, comandos de resolução liberam. Workflow de lembretes permanece desativado. |
| Yango | Testes simulados de vínculo, tarifa explícita, domínio, confirmação de envio e duplicação. Homologação real completa permanece pendente. |
| Horários e terça | Regras de La Paz, janela do dia, chantilly, compra do dia pelo PedidosYa e personalizados com resposta quarta somente na terça revisadas. |
| Catálogo e economia | Modelo Luna mantido, consulta por famílias e contexto compacto. Catálogo inicial planejado antes do envio, sem confirmação falsa de envio. |
| Estilo e ofertas | Regras de idioma, pergunta quando útil, ausência de negrito/travessão, retirada/delivery, copo descontinuado, Combo Perfecto 45 Bs e adicionais mantidas. Sanitização de mensagens testada. |
| Organização e continuidade | Prompt versionado e alinhado ao n8n. Limpeza histórica dos 27 workflows e correções financeiras de pessoas específicas não foram refeitas nem inferidas como verificadas por esta auditoria. |

## Limites e pontos que ainda exigem atenção

- Estoque consultado não equivale a reserva atômica de mercadoria. O registro do agente valida SKU e preço, mas não implementa reserva de estoque entre clientes simultâneos. Não há garantia contra disputa pela última unidade.
- A coleta de endereço e horário também depende do agente: o servidor aceita alguns campos ausentes. Testes de regras não demonstram que o modelo nunca omitirá uma pergunta.
- Mapeamento reverso de LID começa a existir quando há nova entrada com LID. Conversas antigas sem esse vínculo podem continuar dependendo do vencimento da pausa Redis.
- O painel usa pausa de 30 minutos, enquanto há pausa Redis de 2 horas. Esta rodada preserva essa duração existente; a liberação explícita é sincronizada. Não se deve afirmar retomada automática uniforme após 30 minutos.
- As respostas antigas mostram recusas comerciais indevidas por espera da equipe e respostas que apenas acusavam recebimento de localização. A política de venda padrão e a proteção contra falso registro já foram corrigidas no commit ed92575. Sua eficácia no modelo atual precisa de observação de novas conversas; não foi simulada com chamadas pagas.
- Não é possível garantir ausência de alucinação por inspeção de código. Também não foi prometida autonomia para personalizados, preço sob consulta ou disponibilidade não comprovada.

## Validação local

102 testes aprovados, zero falhas; `tsc --noEmit` aprovado. Inclui testes novos de reset, resolução repetida, autorização, callbacks duplicados, limpeza de pausa e idempotência do patch do grafo. Publicação deve ocorrer com backup e leitura de conferência após o deploy do backend.
