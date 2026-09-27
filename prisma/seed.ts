// Carrega o cardápio oficial (Menú Gula dos Meninos 2026/01) e o usuário admin.
// Seguro para rodar a cada deploy: o cardápio só é carregado com o banco vazio.
// Depois disso quem manda são os sócios pelo painel (preços, nomes, estoque).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type VariantSeed = { name: string; servings?: string; price: number };
type ProductSeed = {
  name: string;
  description?: string;
  variants: VariantSeed[];
  priceOnRequest?: boolean;
  trackStock?: boolean;
};
type CategorySeed = {
  name: string;
  slug: string;
  description?: string;
  /** Tortas são feitas sob encomenda; cuchareables ficam prontos em estoque. */
  trackStock: boolean;
  products: ProductSeed[];
};

const TAMANHOS = {
  P: "Entre 8 y 10 personas",
  M: "Hasta 15 personas",
  G: "Hasta 25 personas",
  GG: "Hasta 40 personas",
};

function tamanhos(p: number, m: number, g: number, gg: number): VariantSeed[] {
  return [
    { name: "P", servings: TAMANHOS.P, price: p },
    { name: "M", servings: TAMANHOS.M, price: m },
    { name: "G", servings: TAMANHOS.G, price: g },
    { name: "GG", servings: TAMANHOS.GG, price: gg },
  ];
}

const unico = (price: number): VariantSeed[] => [{ name: "Único", price }];
const tamanhoG = (price: number): VariantSeed[] => [
  { name: "G", servings: TAMANHOS.G, price },
];

const personalizada = (name: string, description: string): ProductSeed => ({
  name,
  description,
  priceOnRequest: true,
  trackStock: false,
  variants: [{ name: "A consultar", price: 0 }],
});

const CARDAPIO: CategorySeed[] = [
  {
    name: "Campeones de Ventas",
    slug: "campeones",
    trackStock: false,
    description: "Tortas favoritas dos clientes, em 4 tamanhos.",
    products: [
      {
        name: "Brigadeiro de Nido con Brigadeiro de Chocolate",
        variants: tamanhos(120, 190, 230, 400),
      },
      {
        name: "Brigadeiro de Beijinho con Brigadeiro de Chocolate",
        variants: tamanhos(120, 190, 230, 400),
      },
      {
        name: "Brigadeiro de Chocolate",
        variants: tamanhos(120, 190, 230, 400),
      },
      {
        name: "Brigadeiro de Maracuyá con Chocolate",
        description:
          "Brigadeiro de maracuyá con brigadeiro de chocolate y mermelada de maracuyá.",
        variants: tamanhos(130, 200, 260, 450),
      },
    ],
  },
  {
    name: "Cuchareables Clásicos",
    slug: "cuchareables-clasicos",
    trackStock: true,
    description: "Tortas de pote com massa de chocolate. 20 Bs.",
    products: [
      { name: "Cuchareable Nido con Brigadeiro de Chocolate", variants: unico(20) },
      {
        name: "Cuchareable Dulce de Leche con Brigadeiro de Chocolate",
        variants: unico(20),
      },
      { name: "Cuchareable Brigadeiro de Chocolate", variants: unico(20) },
      {
        name: "Cuchareable Prestigio",
        description: "Brigadeiro de chocolate con coco.",
        variants: unico(20),
      },
      {
        name: "Cuchareable Maracuyá con Brigadeiro de Chocolate",
        variants: unico(20),
      },
    ],
  },
  {
    name: "Cuchareables Premium",
    slug: "cuchareables-premium",
    trackStock: true,
    description: "Tortas de pote especiais. 25 Bs.",
    products: [
      {
        name: "Cuchareable Nido con Frutilla",
        description: "Nido con mermelada de frutilla, con masa de vainilla.",
        variants: unico(25),
      },
      {
        name: "Cuchareable Nido con Frutos Rojos",
        description: "Nido con mermelada de frutos rojos, con masa de vainilla.",
        variants: unico(25),
      },
      {
        name: "Cuchareable Chocolate con Zanahoria",
        description: "Brigadeiro de chocolate con masa de zanahoria.",
        variants: unico(25),
      },
      {
        name: "Cuchareable Moca",
        description: "Brigadeiro de moca (café), con masa de chocolate.",
        variants: unico(25),
      },
    ],
  },
  {
    name: "Tortas Premium",
    slug: "tortas-premium",
    trackStock: false,
    description: "Tortas especiais tamanho G (até 25 pessoas).",
    products: [
      {
        name: "Torta Avellana & Cereza",
        description:
          "Masa de chocolate, relleno de brigadeiro de avellana, cubierta con ganache de chocolate. Decorada con cerezas y avellanas.",
        variants: tamanhoG(550),
      },
      {
        name: "Torta Coco Premium",
        description:
          "Masa de chocolate, relleno de brigadeiro de coco, cubierta con ganache blindada de brigadeiro de chocolate. Decorada con coco rallado y bolitas de beijinho.",
        variants: tamanhoG(375),
      },
      {
        name: "Torta Nido Intenso",
        description:
          "Masa de chocolate, relleno de brigadeiro de Nido con crema de avellanas, cubierta con ganache blindada de chocolate. Decorada con brigadeiro de Nido, bolitas de Nido y frutillas frescas.",
        variants: tamanhoG(500),
      },
      {
        name: "Torta Rosa Negra",
        description:
          "Masa de chocolate, relleno de brigadeiro de chocolate y brigadeiro de maracuyá. Cubierta con brigadeiro de chocolate y perlas de chocolate.",
        variants: tamanhoG(400),
      },
      {
        name: "Matilda Gula",
        description:
          "Masa de chocolate, relleno de brigadeiro de chocolate, cubierta con brigadeiro de chocolate y bolitas de brigadeiro.",
        variants: tamanhoG(420),
      },
    ],
  },
  {
    name: "Tortas Personalizadas",
    slug: "personalizadas",
    trackStock: false,
    description:
      "Chantilly y ganache, sob encomenda. Preço sob consulta, sem controle de estoque.",
    products: [
      personalizada("Personalizada Infantil", "Diversión, color y dulzura para los peques."),
      personalizada("Personalizada Temática", "Diseños únicos que cuentan historias."),
      personalizada("Personalizada Elegancia Minimalista", "Belleza simple que impacta en cada detalle."),
      personalizada("Personalizada Perlas de Elegancia", "Clásica, delicada y sofisticada."),
      personalizada("Personalizada Amor en cada Detalle", "Ideal para sorprender y celebrar con amor."),
      personalizada("Personalizada Floral Azul", "Delicadeza en cada detalle."),
      personalizada("Personalizada Romántica", "Suave, elegante y encantadora."),
      personalizada("Personalizada Perlas Doradas", "Clásica, fina y sofisticada."),
      personalizada("Personalizada Bosque", "Intensa, húmeda y llena de sabor."),
      personalizada("Personalizada Deportiva", "Para los amantes del deporte y la energía."),
    ],
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
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
  } else {
    console.warn("ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum usuário criado.");
  }

  if ((await prisma.product.count()) > 0) {
    console.log("Cardápio já carregado: nada a fazer.");
    return;
  }

  for (const [ci, cat] of CARDAPIO.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug, description: cat.description, sortOrder: ci },
    });

    for (const [pi, p] of cat.products.entries()) {
      const existing = await prisma.product.findFirst({
        where: { name: p.name, categoryId: category.id },
      });
      const data = {
        name: p.name,
        description: p.description ?? null,
        categoryId: category.id,
        priceOnRequest: p.priceOnRequest ?? false,
        trackStock: p.trackStock ?? cat.trackStock,
        sortOrder: pi,
      };
      if (existing) continue;
      const product = await prisma.product.create({ data });

      for (const [vi, v] of p.variants.entries()) {
        await prisma.variant.create({
          data: {
            productId: product.id,
            name: v.name,
            servings: v.servings ?? null,
            price: v.price,
            sortOrder: vi,
          },
        });
      }
    }
    console.log(`✓ ${cat.name}: ${cat.products.length} produtos`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
