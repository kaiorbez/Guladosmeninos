# Gula dos Meninos · Sistema

Painel de **estoque, vendas e indicadores** da Gula dos Meninos. Em breve também o backend do **agente de IA no WhatsApp**.
Especificação completa, cardápio oficial e pendências: [`docs/PRD.md`](docs/PRD.md).

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind · PostgreSQL · Prisma.

## O que o painel faz

- **Visão geral:** faturamento de hoje, dos últimos 7 dias e do mês, ticket médio, lucro estimado, gráfico diário, mais vendidos, vendas por canal e o que repor.
- **Estoque:** menu lateral com as categorias do cardápio. Entrada (+) e saída (−) rápidas, ajuste de contagem, alerta de estoque mínimo e histórico.
- **Nova venda:** o atendente toca no produto e no tamanho, o preço vem do cardápio e o estoque baixa sozinho.
- **Vendas:** histórico por período e cancelamento com devolução ao estoque.
- **Produtos:** preços, custos (margem), estoque mínimo, tamanhos e "sob encomenda" / "preço sob consulta".
- **Equipe:** logins para sócios e atendentes.

## Rodar localmente

Pré-requisitos: Node 20+ e um PostgreSQL.

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL, AUTH_SECRET e o admin
npm run db:push             # cria as tabelas
npm run db:seed             # cardápio oficial 2026/01 + usuário admin
npm run dev                 # http://localhost:3000
```

`npm run db:seed` pode ser rodado de novo com segurança: o cardápio só é carregado com o banco vazio. Depois, tudo se edita pelo painel.

## Publicar no Railway

1. Em [railway.com](https://railway.com), crie um projeto → **Deploy from GitHub repo** → este repositório.
2. No mesmo projeto: **+ New → Database → PostgreSQL**.
3. No serviço do app, em **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referência ao banco)
   - `AUTH_SECRET` = um texto longo e aleatório (`openssl rand -base64 32`)
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` = o primeiro acesso
4. Nada mais a configurar: o `npm start` cria/atualiza as tabelas e roda o seed antes de subir o site
   (seguro de rodar a cada deploy; o cardápio só é carregado com o banco vazio).
5. Em **Settings → Networking → Generate Domain** para ganhar a URL pública.

Build e start já estão no `package.json` (`npm run build` / `npm start`, que respeita a `PORT` do Railway).

## Estrutura

```
app/login               login
app/painel              visão geral (indicadores)
app/painel/estoque      estoque por categoria, produto, novo produto
app/painel/vendas       histórico, nova venda
app/painel/equipe       usuários
lib/inventory.ts        regras de estoque e vendas (usadas também pelo agente)
lib/metrics.ts          consultas dos indicadores
lib/time.ts             "hoje/semana/mês" no fuso de La Paz
prisma/schema.prisma    modelo de dados
prisma/seed.ts          cardápio oficial
docs/PRD.md             especificação do projeto
```
