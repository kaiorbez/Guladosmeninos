# Sinônimos na conferência comercial — 19/10/2026

A conferência anterior ao envio normaliza acentos e maiúsculas tanto no texto quanto nos nomes do catálogo. Agora reconhece cuchareable(s), cucharable(s), postre de cuchara, bolo de pote, bolo no copo e torta en pote como Pote; Nido/Ninho; frutas rojas e frutos rojos/Frutas Vermelhas; frutilla e fresa/Morango; zanahoria/Cenoura; maracuyá/Maracujá; dulce de leche/Doce de Leite; porción/Fatia.

Caso solicitado: “un cuchareable de ninho con frutas rojas: 25 Bs” casa com Pote Ninho com Frutas Vermelhas a 25 Bs, sem FORA_CATALOGO. O texto ao cliente é preservado. Preço diferente, sabor ausente ou estoque controlado zerado continuam bloqueados; fatias e potes não são intercambiáveis.

Em bloqueio real, a descrição técnica fica no aviso da equipe. O cliente recebe somente “Vou confirmar essa informação com a equipe.” ou “Voy a confirmar esa información con el equipo.”, sem código, cláusula normalizada ou referência à conferência interna.

Validação: 199 testes aprovados, incluindo envio integrado com o sinônimo solicitado, divergência real, produto ausente, estoque zero, plural, quantidade, acentos, maiúsculas e distinção entre pote e fatia. TypeScript aprovado. Testes usam banco/transporte simulados e não enviam mensagens reais.
