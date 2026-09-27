# PRD: Sistema Gula dos Meninos

> Implementação das entregas técnicas do **Protocolo Pedido no Automático** (Royal Marketing → Gula dos Meninos):
> **Pilar 3, "Números na Mão"** (painel) e **Pilar 1, "Atendimento que Não Dorme"** (agente de IA no WhatsApp).
> O Pilar 2 (Estratégia Conexão / social media) não é software e está fora deste PRD.

---

## 1. Problema identificado

A Gula dos Meninos é uma pastelaria artesanal na Bolívia (atende em espanhol; os sócios são brasileiros). Hoje:

- **Atendimento sobrecarregado.** Os pedidos chegam durante a produção, as mesmas perguntas se repetem e as mensagens se acumulam antes de abrir e à noite. Na **terça (só delivery)** tudo depende de quem também está produzindo.
- **Falta de tempo.** São **4 sócios** dividindo produção, entrega, atendimento, redes sociais e faculdade.
- **Sem números.** Ninguém sabe com precisão o que mais vende, o que repor nem onde está o lucro. Estoque e vendas não são registrados de forma centralizada.

Impacto: *"Cada mensagem que espera é um cliente com vontade de doce que pode pedir na concorrência."*

## 2. Solução

Um único sistema web (painel + backend do agente), hospedado de forma barata:

1. **Painel de estoque e vendas** (prazo da proposta: **dia 30**). Os sócios e atendentes registram vendas com o preço automático do cardápio, controlam o estoque manualmente (produção, perdas e contagem) e acompanham faturamento do dia, da semana e do mês, os mais vendidos, o lucro e os alertas de reposição.
2. **Agente de IA no WhatsApp** (prazo da proposta: **dia 15**, próxima fase). Responde em **espanhol e português**, 24 h por dia, usando o cardápio e o estoque **do mesmo banco do painel**. Sugere docinhos e kits de festa, monta pedidos e registra a venda, que dá baixa no estoque sozinha.

## 3. Funcionalidades principais

### Fase 1: Painel ✅ implementado

| Funcionalidade | Detalhe |
|---|---|
| Login e autenticação | E-mail + senha (bcrypt), sessão JWT em cookie httpOnly (30 dias), middleware protege `/painel/*`. |
| Multiusuário | Página **Equipe**: adicionar sócios e atendentes e trocar a própria senha. Cada venda e movimentação registra quem fez. |
| Menu lateral | Visão geral, Estoque (com **submenu por categoria do cardápio** e contador de alertas), Nova venda, Vendas e Equipe. No celular vira um menu recolhível. |
| Dashboard | Faturamento de **hoje / 7 dias / mês**, nº de pedidos, ticket médio, **lucro estimado e margem**, gráfico dos últimos 14 dias, mais vendidos do mês, vendas por canal, "O que repor" e últimas vendas. |
| Estoque | Lista por categoria, busca, filtro "só o que precisa repor". Entrada (+) e saída (−) rápidas por linha. **Ajuste de contagem** (informa o valor real). Histórico de movimentações por produto. Bloqueia estoque negativo. |
| Produtos | Criar e editar produto, categoria, descrição (usada pelo agente) e tamanhos com **preço, custo, margem calculada e estoque mínimo**. Flags: *controla estoque* (pronta entrega × sob encomenda), *preço sob consulta* (personalizadas), *ativo*. |
| Nova venda | O atendente toca no produto, escolhe o tamanho, e o **preço vem do cardápio** (editável: desconto ou preço combinado). Personalizadas **exigem** o preço combinado. Canal (Balcão/WhatsApp/Delivery/Instagram), pagamento (QR/Dinheiro/Cartão/Outro), cliente, telefone e observação. **Baixa automática de estoque.** |
| Vendas | Histórico com filtro (hoje / 7 dias / mês / 30 dias / tudo), totais do período e **cancelamento com estorno** automático ao estoque (com confirmação). |
| Fuso horário | "Hoje", "semana" e "mês" calculados no fuso de **La Paz (UTC-4)**, mesmo com o servidor em UTC. |

### Fase 2: Agente de WhatsApp (a fazer)

- Webhook da **WhatsApp Business Cloud API (Meta)**: verificação (`hub.challenge`) e **validação de assinatura** (`X-Hub-Signature-256`).
- Prompt montado a cada conversa com o **cardápio atual do banco** (produtos ativos, tamanhos, preços, estoque de pronta entrega) + as regras de "Cómo elegir tu pedido" (abaixo).
- Detecta o idioma (ES/PT) e responde no mesmo.
- Tortas personalizadas: coleta tema, tamanho, data e referência e **encaminha para um sócio** (preço sob consulta).
- Pedido confirmado: registra `Sale` com canal WHATSAPP via `lib/inventory.ts#createSale` (a mesma regra do painel).
- Histórico de conversas (`Conversation`/`Message`) visível no painel, com opção de um sócio **assumir a conversa** (pausar o agente).
- Métricas para o relatório mensal: **mensagens respondidas**, pedidos pelo agente, produtos mais pedidos.
- 30 dias de ajuste fino: revisão semanal das conversas (Bônus 2 da proposta).

### Fora de escopo por enquanto (possíveis evoluções)

- Estoque de **insumos** (leite Nido, chocolate, embalagens) com ficha técnica por produto.
- Pedidos agendados / agenda de entregas das encomendas.
- Exportação para planilha e relatório mensal automático em PDF.

## 4. Persona e tipos de usuário

| Perfil | Papel |
|---|---|
| **Sócio (4 pessoas)** | Produz, atende e entrega. Quer ver rápido quanto vendeu e o que repor, e ajustar preços e custos. Usa muito o celular. |
| **Atendente** | Registra vendas no balcão/WhatsApp e dá entrada na produção do dia. Precisa de uma tela simples, com toque e sem digitar preço. |
| **Cliente final** | Fala espanhol (Bolívia) ou português. Pede pelo WhatsApp, muitas vezes fora do horário. Interage só com o agente (Fase 2). |
| **Royal Marketing** | Implanta, faz o ajuste fino do agente e extrai números para o relatório mensal. |

> Hoje todos os usuários do painel têm o mesmo acesso. Se for preciso separar sócio × atendente (ex.: atendente não vê lucro), adicionar um campo `role` em `User`.

## 5. Stack tecnológica

- **Next.js 15** (App Router, Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS 3** com a paleta da marca
- **PostgreSQL** + **Prisma 6**
- Autenticação própria: `jose` (JWT) + `bcryptjs`
- Hospedagem recomendada: **Railway** (app + Postgres no mesmo projeto)
- Fase 2: **Anthropic API (Claude)** para o agente e **WhatsApp Business Cloud API (Meta)**

## 6. Referências de design

Tirado do **cardápio oficial 2026/01** (o painel segue a identidade da marca):

- **Cores:** creme de fundo (`#F8F0E5`), marrom-cacau nos textos e botões principais (`#2E1F17`), dourado nos destaques (`#B8863B`), coral/terracota nos alertas e ações de destaque (`#E8735A`, o mesmo dos números "1, 2, 3" do cardápio).
- **Tipografia:** serifada elegante nos títulos (Cormorant Garamond) e sans limpa no corpo (Nunito Sans).
- **Logo:** ilustração dos dois meninos com a torta (`public/logo.png`, extraída do cardápio).
- Tom: acolhedor, "Pastelería con amor, para ti".

---

## Anexo A: Cardápio oficial (fonte: `Menú Guladosmeninos 2026_01.pdf`)

Contato: WhatsApp **+591 75577829** · Instagram **@Guladosmeninos**

**Tamaños:** P (entre 8 y 10 personas) · M (hasta 15) · G (hasta 25) · GG (hasta 40) · Personalizados (consultar)

### Campeones de Ventas (tortas; foto de referência: 1,300 g)
| Torta | P | M | G | GG |
|---|---|---|---|---|
| Brigadeiro de Nido con Brigadeiro de Chocolate | 120 | 190 | 230 | 400 |
| Brigadeiro de Beijinho con Brigadeiro de Chocolate | 120 | 190 | 230 | 400 |
| Brigadeiro de Chocolate | 120 | 190 | 230 | 400 |
| Brigadeiro de Maracuyá con brigadeiro de chocolate y mermelada de maracuyá | 130 | 200 | 260 | 450 |

### Tortas Cuchareables
- **Clásicos, 20 Bs** (masa de chocolate): Nido con brigadeiro de chocolate · Dulce de leche con brigadeiro de chocolate · Brigadeiro de chocolate · Prestigio (brigadeiro de chocolate con coco) · Maracuyá con brigadeiro de chocolate
- **Premium, 25 Bs:** Nido con mermelada de frutilla (masa de vainilla) · Nido con mermelada de frutos rojos (masa de vainilla) · Brigadeiro de chocolate con masa de zanahoria · Brigadeiro de moca (café) con masa de chocolate

### Tortas Premium (tamaño G, hasta 25 personas)
| Torta | Preço | Descrição |
|---|---|---|
| Torta Avellana & Cereza | 550 | Masa de chocolate, brigadeiro de avellana, ganache de chocolate; cerezas y avellanas |
| Torta Coco Premium | 375 | Masa de chocolate, brigadeiro de coco, ganache blindada de brigadeiro de chocolate; coco rallado y bolitas de beijinho |
| Torta Nido Intenso | 500 | Masa de chocolate, brigadeiro de Nido con crema de avellanas, ganache blindada; brigadeiro de Nido, bolitas de Nido y frutillas |
| Torta Rosa Negra | 400 | Masa de chocolate, brigadeiro de chocolate y de maracuyá; cubierta de brigadeiro de chocolate y perlas de chocolate |
| Matilda Gula | 420 | Masa de chocolate, brigadeiro de chocolate, cubierta de brigadeiro de chocolate y bolitas de brigadeiro |

### Tortas Personalizadas: Chantilly y Ganache (preço sob consulta)
Infantil · Temáticas · Elegancia Minimalista · Perlas de Elegancia · Amor en cada Detalle · Floral Azul · Romántica · Perlas Doradas · Bosque · Deportivas.
Slogan: *"¡Tu idea, nuestra creación!"*. Para toda ocasião: aniversários, eventos e mais.

### "Cómo elegir tu pedido" (regras para o agente, Fase 2)
1. **Tamaño:** P / M / G / GG / personalizado
2. **Sabor de la masa:** Chocolate · Vainilla · personalizado (consultar)
3. **Rellenos:** Brigadeiro de Nido · Brigadeiro de Chocolate · Beijinho (coco) · Brigadeiro de Dulce de leche · Brigadeiro de Maracuyá · Brigadeiro de Limón · Brigadeiro de Café · Brigadeiro de Prestigio · Brigadeiro de Dulce de leche con coco · Brigadeiro de Churros · personalizado (consultar)

> ⚠ **Preço de combinações livres (massa + recheio fora dos Campeones) não consta no cardápio.** Confirmar com os sócios antes da Fase 2.

## Anexo B: Pendências de informação com o cliente

- [ ] Preço de tortas montadas com massa e recheios livres (ver acima).
- [ ] **Empadões, docinhos e kits de festa** aparecem na proposta, mas **não estão no cardápio PDF**. Pedir itens e preços e cadastrar pelo painel (Novo produto).
- [ ] **Custo** de cada produto, para o lucro ficar real (hoje o painel avisa quantos itens estão sem custo).
- [ ] Quais itens ficam **prontos em estoque**. Padrão atual: cuchareables = estoque; tortas = sob encomenda (dá para alternar por produto).
- [ ] Horário de funcionamento, dias de delivery (terça só delivery), taxa e área de entrega, antecedência mínima para encomendas e formas de pagamento aceitas. **Necessário para o agente.**
- [ ] Acessos: número do WhatsApp Business (+591 75577829) no Meta for Developers.
