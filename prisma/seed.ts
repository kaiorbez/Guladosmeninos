// Carrega o cardápio, o catálogo do PedidosYa e o usuário admin.
// Roda a cada deploy (npm start) e é idempotente:
//  - banco vazio: carrega tudo;
//  - banco da 1ª versão (nomes em espanhol): traduz nomes e põe fotos, sem tocar em
//    preços, custos, estoque ou vendas;
//  - sem anúncios do PedidosYa ainda: cria os produtos que faltavam e o catálogo do app;
//  - depois disso não faz nada: quem manda são os sócios pelo painel.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CARDAPIO, EXTRAS, LEGACY_SERVINGS, type CategorySeed, type ProductSeed } from "./data/cardapio";
import { PEDIDOSYA } from "./data/pedidosya";

const prisma = new PrismaClient();

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum usuário criado.");
    return;
  }
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      name: process.env.ADMIN_NAME ?? "Admin",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  console.log(`Usuário admin: ${email}`);
}

// Ordem das categorias no painel (pedido dos sócios); personalizadas por último.
const ORDER = [
  "campeones",
  "empadoes",
  "cuchareables-clasicos",
  "fatias",
  "combos",
  "cuchareables-premium",
  "tortas-premium",
  "docinhos",
  "bebidas",
  "velas",
  "personalizadas",
];

/** Roda `fn` uma única vez por banco. */
async function once(id: string, fn: () => Promise<void>) {
  if (await prisma.dataMigration.findUnique({ where: { id } })) return;
  await fn();
  await prisma.dataMigration.create({ data: { id } });
  console.log(`✓ migração ${id}`);
}

/** Garante a categoria; na migração da 1ª versão traduz o nome e define o grupo. */
async function ensureCategory(cat: CategorySeed, migrate: boolean) {
  const sortOrder = ORDER.indexOf(cat.slug);
  const existing = await prisma.category.findUnique({ where: { slug: cat.slug } });
  if (!existing) {
    return prisma.category.create({
      data: { slug: cat.slug, name: cat.name, group: cat.group, description: cat.description, sortOrder },
    });
  }
  if (migrate || existing.group === null) {
    return prisma.category.update({
      where: { id: existing.id },
      data: {
        name: existing.name === (cat.legacy ?? cat.name) ? cat.name : existing.name,
        group: existing.group ?? cat.group,
        description: cat.description ?? existing.description,
        sortOrder,
      },
    });
  }
  return existing;
}

async function createProduct(categoryId: string, cat: CategorySeed, p: ProductSeed, sortOrder: number) {
  return prisma.product.create({
    data: {
      name: p.name,
      description: p.description ?? null,
      imageUrl: p.image ?? null,
      categoryId,
      priceOnRequest: p.priceOnRequest ?? false,
      trackStock: p.trackStock ?? cat.trackStock,
      onStore: p.onStore ?? true,
      sortOrder,
      variants: {
        create: p.variants.map((v, i) => ({
          name: v.name,
          servings: v.servings ?? null,
          price: v.price,
          sortOrder: i,
        })),
      },
    },
  });
}

async function main() {
  await ensureAdmin();

  const empty = (await prisma.product.count()) === 0;
  const legacyOnly = CARDAPIO.flatMap((c) => c.products)
    .filter((p) => p.legacy && p.legacy !== p.name)
    .map((p) => p.legacy!);
  const migrate = !empty && (await prisma.product.count({ where: { name: { in: legacyOnly } } })) > 0;

  // 1. Cardápio da loja
  for (const cat of CARDAPIO) {
    const category = await ensureCategory(cat, migrate);
    for (const [pi, p] of cat.products.entries()) {
      if (empty) {
        await createProduct(category.id, cat, p, pi);
        continue;
      }
      if (!migrate) continue;
      const old = p.legacy ? await prisma.product.findFirst({ where: { categoryId: category.id, name: p.legacy } }) : null;
      if (old) {
        await prisma.product.update({
          where: { id: old.id },
          data: { name: p.name, description: p.description ?? old.description, imageUrl: old.imageUrl ?? p.image ?? null, sortOrder: pi },
        });
        // Vendas já registradas guardam o nome antigo: atualiza para o nome em português.
        for (const v of await prisma.variant.findMany({ where: { productId: old.id } })) {
          await prisma.saleItem.updateMany({
            where: { variantId: v.id },
            data: { description: v.name === "Único" || v.name === "A consultar" ? p.name : `${p.name} (${v.name})` },
          });
        }
      } else if (!(await prisma.product.findFirst({ where: { categoryId: category.id, name: p.name } }))) {
        await createProduct(category.id, cat, p, pi);
      }
    }
    if (empty || migrate) console.log(`✓ ${cat.name}`);
  }
  if (migrate) {
    for (const [es, pt] of Object.entries(LEGACY_SERVINGS)) {
      await prisma.variant.updateMany({ where: { servings: es }, data: { servings: pt } });
    }
    await prisma.variant.updateMany({ where: { name: "A consultar" }, data: { name: "Sob consulta" } });
  }

  // 2. Produtos que só apareciam no PedidosYa + catálogo do app (uma vez só)
  if ((await prisma.pedidosYaItem.count()) === 0) {
    for (const cat of EXTRAS) {
      const category = await ensureCategory(cat, false);
      const base = await prisma.product.count({ where: { categoryId: category.id } });
      for (const [pi, p] of cat.products.entries()) {
        const exists = await prisma.product.findFirst({ where: { name: p.name } });
        if (!exists) await createProduct(category.id, cat, p, base + pi);
      }
    }

    let created = 0;
    for (const [i, item] of PEDIDOSYA.entries()) {
      const variant = await prisma.variant.findFirst({
        where: { name: item.variant, product: { name: item.product } },
      });
      if (!variant) {
        console.warn(`PedidosYa: sem produto para "${item.name}" (${item.product} / ${item.variant})`);
        continue;
      }
      await prisma.pedidosYaItem.create({
        data: {
          section: item.section,
          name: item.name,
          description: item.description ?? null,
          price: item.price,
          listPrice: item.listPrice ?? null,
          variantId: variant.id,
          needsReview: item.review ?? false,
          sortOrder: i,
        },
      });
      created++;
    }
    console.log(`✓ PedidosYa: ${created} anúncios`);
  }

  // Vendas registradas antes da tradução guardam o nome antigo: usa o nome atual do produto.
  await once("2026-09-nomes-vendas-pt", async () => {
    const legacy = CARDAPIO.flatMap((c) => c.products).map((p) => p.legacy).filter(Boolean) as string[];
    const items = await prisma.saleItem.findMany({
      where: { OR: legacy.map((n) => ({ description: { startsWith: n } })) },
      include: { variant: { include: { product: { select: { name: true } } } } },
    });
    for (const i of items) {
      const v = i.variant;
      const label = v.name === "Único" || v.name === "Sob consulta" ? v.product.name : `${v.product.name} (${v.name})`;
      await prisma.saleItem.update({ where: { id: i.id }, data: { description: label } });
    }
  });

  // Kits de aniversário informados pelos sócios (preço do WhatsApp).
  await once("2026-09-combo-aniversario", async () => {
    const combos = await prisma.category.findUnique({ where: { slug: "combos" } });
    if (!combos || (await prisma.product.findFirst({ where: { name: "Combo de Aniversário" } }))) return;
    await prisma.product.create({
      data: {
        name: "Combo de Aniversário",
        description: "Kit de aniversário. P até 10 pessoas, M até 15 pessoas, G até 25 pessoas.",
        categoryId: combos.id,
        trackStock: false,
        onStore: true,
        sortOrder: -1,
        variants: {
          create: [
            { name: "P", servings: "até 10 pessoas", price: 160, sortOrder: 0 },
            { name: "M", servings: "até 15 pessoas", price: 270, sortOrder: 1 },
            { name: "G", servings: "até 25 pessoas", price: 400, sortOrder: 2 },
          ],
        },
      },
    });
  });

  await once("2026-09-ordem-categorias", async () => {
    for (const [i, slug] of ORDER.entries()) {
      await prisma.category.updateMany({ where: { slug }, data: { sortOrder: i } });
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
