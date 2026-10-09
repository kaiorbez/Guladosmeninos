// Carrega o cardápio, o catálogo do PedidosYa e o usuário admin.
// Roda a cada deploy (npm start) e é idempotente:
//  - banco vazio: carrega tudo;
//  - banco da 1ª versão (nomes em espanhol): traduz nomes e põe fotos, sem tocar em
//    preços, custos, estoque ou vendas;
//  - sem anúncios do PedidosYa ainda: cria os produtos que faltavam e o catálogo do app;
//  - depois disso não faz nada: quem manda são os sócios pelo painel.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CARDAPIO, EXTRAS, LEGACY_SERVINGS, type CategorySeed, type ProductSeed, type VariantSeed } from "./data/cardapio";
import { PEDIDOSYA } from "./data/pedidosya";
import { bookPayment } from "../lib/orders";

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

  // Adicionais oficiais do prompt: SKU real para que o agente não invente preço.
  // Acrescenta uma vez, preservando edições posteriores dos sócios.
  await once("2026-10-adicionais-agente",async()=>{
    const extras:[string,number[]][]=[
      ["Morango na decoração",[20,30,40,50]],["Morango no recheio",[20,30,30,40]],
      ["Maracujá no recheio",[10,20,30,40]],["Geleia de maracujá",[10,20,30,40]],
      ["Geleia de morango",[10,20,30,40]],["Geleia de frutas vermelhas",[10,20,30,40]],
      ["Suspiros",[10,20,30,40]],["Camada extra no bolo",[40,64,67,160]],
      ["Chantilly",[60,60,80,80]],["Cereja",[10,20,30,40]],
    ];
    const cat:CategorySeed={slug:'adicionais-bolo',name:'Adicionais de bolo',group:'Tortas',trackStock:false,products:[]};
    const category=await ensureCategory(cat,false);
    for(const [i,[name,prices]] of extras.entries()) {
      if(await prisma.product.findFirst({where:{categoryId:category.id,name}}))continue;
      await createProduct(category.id,cat,{name,description:'Adicional por tamanho do bolo, somente mediante aceite do cliente.',trackStock:false,onStore:true,variants:prices.map((price,index)=>({name:['P','M','G','GG'][index],price}))},i);
    }
  });

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

  // Os sócios confirmaram: o que está no PedidosYa também é vendido no WhatsApp.
  // Enquanto não definem o preço do WhatsApp, fica o do app como referência.
  await once("2026-09-tudo-nos-dois-canais", async () => {
    await prisma.product.updateMany({ where: { onStore: false }, data: { onStore: true } });
    // Combo Festa P ainda sem preço: pede o valor combinado na hora da venda.
    await prisma.product.updateMany({ where: { name: "Combo Festa P" }, data: { priceOnRequest: true } });
  });

  // Sócios: "Campeões de Venda" são os Naked Cakes.
  await once("2026-09-naked-cake", async () => {
    await prisma.category.updateMany({
      where: { slug: "campeones" },
      data: { name: "Naked Cake", description: "Naked cakes, os campeões de venda, em 4 tamanhos." },
    });
  });

  // Sócios: o "Combo fiesta p" do PedidosYa é o Combo de Aniversário P.
  await once("2026-09-combo-fiesta-aniversario", async () => {
    const kitP = await prisma.variant.findFirst({ where: { name: "P", product: { name: "Combo de Aniversário" } } });
    const festa = await prisma.product.findFirst({ where: { name: "Combo Festa P" }, include: { variants: true } });
    if (!kitP || !festa) return;
    const ids = festa.variants.map((v) => v.id);
    await prisma.pedidosYaItem.updateMany({ where: { variantId: { in: ids } }, data: { variantId: kitP.id } });
    const sold = await prisma.saleItem.count({ where: { variantId: { in: ids } } });
    if (sold > 0) {
      await prisma.product.update({ where: { id: festa.id }, data: { active: false } });
    } else {
      await prisma.stockMovement.deleteMany({ where: { variantId: { in: ids } } });
      await prisma.product.delete({ where: { id: festa.id } });
    }
  });

  await once("2026-09-ordem-categorias", async () => {
    for (const [i, slug] of ORDER.entries()) {
      await prisma.category.updateMany({ where: { slug }, data: { sortOrder: i } });
    }
  });

  // Cardápio 2026 do agente do WhatsApp: itens que faltavam no painel e preços da loja
  // confirmados pelos sócios (o preço do PedidosYa fica no anúncio, não muda aqui).
  await once("2026-10-cardapio-agente", async () => {
    /** Cria o produto se não existir e garante cada tamanho com o preço informado. */
    const ensure = async (
      categoryId: string,
      name: string,
      trackStock: boolean,
      variants: VariantSeed[],
      description?: string,
    ) => {
      const product =
        (await prisma.product.findFirst({ where: { name } })) ??
        (await prisma.product.create({
          data: {
            name,
            description: description ?? null,
            categoryId,
            trackStock,
            onStore: true,
            sortOrder: await prisma.product.count({ where: { categoryId } }),
          },
        }));
      for (const [i, v] of variants.entries()) {
        await prisma.variant.upsert({
          where: { productId_name: { productId: product.id, name: v.name } },
          update: { price: v.price, sortOrder: i },
          create: { productId: product.id, name: v.name, servings: v.servings ?? null, price: v.price, sortOrder: i },
        });
      }
    };

    // Docinhos: unidade é pronta entrega; o cento é feito por encomenda.
    const docinhos = await prisma.category.upsert({
      where: { slug: "docinhos" },
      update: {},
      create: { slug: "docinhos", name: "Docinhos e Kits de Festa", group: "Doces", sortOrder: ORDER.indexOf("docinhos") },
    });
    const sabores = ["Brigadeiro", "Beijinho", "Paçoca", "Ninho", "Maracujá", "Churros", "Café", "Doce de Leite", "Bicho de Pé", "Azul Encantado"];
    for (const sabor of sabores) {
      await ensure(docinhos.id, `Docinho ${sabor}`, true, [{ name: "Unidade", price: 3.5 }]);
    }
    await ensure(docinhos.id, "Docinhos (Cento)", false, [{ name: "Cento", price: 300 }], "100 docinhos, sabores a combinar.");

    // Salgados
    const empadoes = await prisma.category.upsert({
      where: { slug: "empadoes" },
      update: {},
      create: { slug: "empadoes", name: "Empadões", group: "Salgados", sortOrder: ORDER.indexOf("empadoes") },
    });
    await ensure(empadoes.id, "Empadão de Frango", true, [
      { name: "P", servings: "250 g", price: 20 },
      { name: "M", servings: "750 g", price: 65 },
      { name: "G", servings: "1,3 kg", price: 120 },
    ], "Frango com requeijão.");
    await ensure(empadoes.id, "Empadão de Fricassê", true, [
      { name: "P", servings: "250 g", price: 20 },
      { name: "M", servings: "750 g", price: 65 },
    ], "Fricassê de frango, massa leve.");
    await ensure(empadoes.id, "Empadinha de Frango", true, [{ name: "Unidade", servings: "55 g", price: 6.5 }], "Frango com requeijão (55 g).");
    await ensure(empadoes.id, "Empadinhas (Cento)", false, [{ name: "Cento", price: 600 }], "100 empadinhas de frango com requeijão.");
    await ensure(empadoes.id, "Torta Pão", false, [
      { name: "P", servings: "8 porções", price: 50 },
      { name: "M", servings: "16 porções", price: 95 },
    ]);

    // Porções de torta: preço da loja nas fatias já cadastradas.
    const fatias = await prisma.category.upsert({
      where: { slug: "fatias" },
      update: {},
      create: { slug: "fatias", name: "Fatias de Torta", group: "Tortas", sortOrder: ORDER.indexOf("fatias") },
    });
    await ensure(fatias.id, "Fatia Prestígio", true, [{ name: "Único", price: 30 }]);
    await ensure(fatias.id, "Fatia Maracujá", true, [{ name: "Único", price: 30 }]);
    await ensure(fatias.id, "Fatia Cenoura com Chocolate", true, [{ name: "Único", price: 30 }]);
    await ensure(fatias.id, "Fatia Baunilha com Frutas Vermelhas", true, [{ name: "Único", price: 35 }]);

    // Tortas em acetato (encomenda), logo depois das Tortas Premium.
    let acetato = await prisma.category.findUnique({ where: { slug: "acetato" } });
    if (!acetato) {
      const premium = await prisma.category.findUnique({ where: { slug: "tortas-premium" } });
      const after = premium?.sortOrder ?? ORDER.indexOf("tortas-premium");
      await prisma.category.updateMany({ where: { sortOrder: { gt: after } }, data: { sortOrder: { increment: 1 } } });
      acetato = await prisma.category.create({
        data: { slug: "acetato", name: "Tortas em Acetato", group: "Tortas", description: "Tortas em acetato, modelos 01 a 12, sob encomenda.", sortOrder: after + 1 },
      });
    }
    const modelos = [
      [135, 200, 240, 495],
      [180, 270, 340, 650],
      [160, 250, 300, 630],
      [200, 285, 340, 700],
      [160, 250, 300, 620],
      [150, 240, 290, 580],
      [180, 260, 320, 630],
      [140, 230, 390, 530],
      [165, 250, 300, 620],
      [160, 240, 295, 565],
      [150, 240, 300, 560],
      [150, 220, 270, 530],
    ];
    for (const [i, [p, m, g, gg]] of modelos.entries()) {
      await ensure(acetato.id, `Torta em Acetato Modelo ${String(i + 1).padStart(2, "0")}`, false, [
        { name: "P", price: p },
        { name: "M", price: m },
        { name: "G", price: g },
        { name: "GG", price: gg },
      ]);
    }

    // Sócios: o Combo de Aniversário é o "Kit Fiesta" do cardápio.
    if (!(await prisma.product.findFirst({ where: { name: "Kit Fiesta" } }))) {
      await prisma.product.updateMany({
        where: { name: "Combo de Aniversário" },
        data: { name: "Kit Fiesta", description: "Kit de festa (combo de aniversário). P até 10 pessoas, M até 15 pessoas, G até 25 pessoas." },
      });
    }
  });

  // Sócios: estoque provisório de 10 em cada item de pronta entrega, para o agente do
  // WhatsApp não ser barrado enquanto a contagem real não é lançada.
  await once("2026-10-estoque-provisorio", async () => {
    const variants = await prisma.variant.findMany({
      where: { active: true, stock: { lt: 10 }, product: { active: true, trackStock: true } },
    });
    for (const v of variants) {
      await prisma.variant.update({ where: { id: v.id }, data: { stock: 10 } });
      await prisma.stockMovement.create({
        data: { variantId: v.id, type: "AJUSTE", quantity: 10 - v.stock, stockAfter: 10, note: "Estoque provisório (aguardando contagem real)" },
      });
    }
  });

  // "Docinhos (Cento)" aparecia como "Docinhos (Cento) (Cento)": o tamanho já diz que é o cento.
  await once("2026-10-nomes-cento", async () => {
    await prisma.product.updateMany({ where: { name: "Docinhos (Cento)" }, data: { name: "Docinhos" } });
    await prisma.product.updateMany({ where: { name: "Empadinhas (Cento)" }, data: { name: "Empadinhas" } });
  });

  // Venda de teste da API do agente (nº 2, 02/10/2026): cancela e devolve o estoque.
  await once("2026-10-cancela-venda-teste", async () => {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { externalRef: "teste-claude-2026-10-02-1", status: "CONFIRMADA" } });
      if (!sale) return;
      await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELADA" } });
      for (const m of await tx.stockMovement.findMany({ where: { saleId: sale.id, type: "VENDA" } })) {
        const v = await tx.variant.update({ where: { id: m.variantId }, data: { stock: { increment: -m.quantity } } });
        await tx.stockMovement.create({
          data: { variantId: m.variantId, type: "ESTORNO", quantity: -m.quantity, stockAfter: v.stock, saleId: sale.id, note: `Cancelamento da venda #${sale.number} (teste)` },
        });
      }
    });
  });

  // Encomendas criadas antes do histórico de pagamentos: o valor pago vira um pagamento.
  await once("2026-10-pagamentos-encomendas", async () => {
    const orders = await prisma.order.findMany({ where: { paid: { gt: 0 }, payments: { none: {} } } });
    for (const o of orders) {
      await prisma.orderPayment.create({ data: { orderId: o.id, amount: o.paid, method: "OTRO", paidAt: o.createdAt } });
    }
  });

  // Pagamentos registrados antes de "pagamento entra no faturamento na hora": os das
  // encomendas ainda pendentes entram agora, no dia em que foram recebidos.
  // Encomendas entregues já estão no faturamento pela venda da entrega; canceladas ficam como estão.
  await once("2026-10-faturar-pagamentos-antigos", async () => {
    const payments = await prisma.orderPayment.findMany({
      where: { saleId: null, order: { status: "PENDENTE" } },
      orderBy: { paidAt: "asc" },
    });
    for (const p of payments) {
      await bookPayment(p.id);
      const booked = await prisma.orderPayment.findUnique({ where: { id: p.id } });
      if (booked?.saleId) await prisma.sale.update({ where: { id: booked.saleId }, data: { createdAt: p.paidAt } });
    }
    console.log(`  ${payments.length} pagamento(s) antigo(s) levado(s) ao faturamento`);
  });
  // Oferta permanente confirmada pelo proprietário em 05/10/2026.
  // Produto separado: preservar preços, IDs e encomendas dos outros combos.
  await once("2026-10-05-combo-perfecto-permanente", async () => {
    await prisma.$transaction(async tx => {
      const category = await tx.category.upsert({ where: { slug: "combos" }, update: {}, create: { slug: "combos", name: "Combos", group: "Combos" } });
      const existing = await tx.product.findFirst({ where: { name: "Combo Perfecto" } });
      const data = { name: "Combo Perfecto", categoryId: category.id, description: "1 empadão P + 1 bolo de pote + 1 Coca-Cola Zero 300 ml. Combo sempre disponível, conforme orientação da loja. Consultar sabores do bolo de pote; não presumir disponibilidade permanente de cada sabor. Valor total do combo: 45 Bs.", trackStock: false, priceOnRequest: false, active: true, onStore: true };
      const product = existing ? await tx.product.update({ where: { id: existing.id }, data }) : await tx.product.create({ data });
      await tx.variant.upsert({ where: { productId_name: { productId: product.id, name: "Único" } }, update: { price: 45, active: true }, create: { productId: product.id, name: "Único", price: 45, active: true } });
    });
  });
  // Preços do combo COMPLETO confirmados pelo proprietário em 08/10/2026.
  await once("2026-10-08-combo-fatia-permanente", async () => {
    await prisma.$transaction(async tx => {
      const category = await tx.category.upsert({ where: { slug: "combos" }, update: {}, create: { slug: "combos", name: "Combos", group: "Combos" } });
      const existing = await tx.product.findFirst({ where: { name: "Combo Fatia" } });
      const data = { name: "Combo Fatia", categoryId: category.id, description: "Combo completo: 1 fatia + 1 empadão + 1 Coca-Cola. Oferta e quatro sabores sempre disponíveis, conforme confirmação da loja. O preço de cada variante é o TOTAL DO COMBO, não da fatia avulsa. Não cobrar empadão e Coca-Cola novamente. Tamanho/sabor do empadão e volume/tipo da Coca-Cola não informados; não presumir. Disponibilidade não altera horários nem regras de terça-feira.", trackStock: false, priceOnRequest: false, active: true, onStore: true };
      const product = existing ? await tx.product.update({ where: { id: existing.id }, data }) : await tx.product.create({ data });
      for (const [name, price] of [["Prestígio", 30], ["Maracujá com brigadeiro de chocolate", 30], ["Ninho com geleia de frutas vermelhas", 35], ["Cenoura com brigadeiro de chocolate", 30]] as const) {
        await tx.variant.upsert({ where: { productId_name: { productId: product.id, name } }, update: { price, active: true }, create: { productId: product.id, name, price, active: true } });
      }
    });
  });
  // Limpeza única solicitada pelo proprietário. Apenas fixtures do telefone de teste autorizado,
  // sem pagamento, venda ou alteração de estoque. Auditoria de envios permanece preservada.
  await once("2026-10-limpeza-testes-autorizada-kaio", async () => {
    await prisma.$transaction(async tx => {
      const removed = await tx.order.deleteMany({ where: {
        customerPhone: "59175678921", customerName: { startsWith: "[TESTE]" },
        paid: 0, saleId: null, payments: { none: {} },
      } });
      const tickets = await tx.agentTicket.deleteMany({ where: {
        phone: "59175678921", customerName: { startsWith: "[TESTE]" },
      } });
      console.log(`Limpeza autorizada: ${removed.count} encomendas e ${tickets.count} pendências de teste removidas.`);
    });
  });

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

