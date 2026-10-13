// Cardápio oficial da loja (Menú Gula dos Meninos 2026/01), em português.
// `legacy` = nome usado na 1ª versão do sistema (espanhol), para migrar bancos antigos.

export type VariantSeed = { name: string; servings?: string; price: number };
export type ProductSeed = {
  name: string;
  legacy?: string;
  description?: string;
  image?: string;
  variants: VariantSeed[];
  priceOnRequest?: boolean;
  trackStock?: boolean;
  /** false = só existe no PedidosYa (preço da loja ainda não definido). */
  onStore?: boolean;
};
export type CategorySeed = {
  slug: string;
  name: string;
  legacy?: string;
  group: string;
  description?: string;
  /** Tortas inteiras são feitas sob encomenda; o resto fica pronto em estoque. */
  trackStock: boolean;
  products: ProductSeed[];
};

export const SERVE = {
  P: "8 a 10 pessoas",
  M: "até 15 pessoas",
  G: "até 25 pessoas",
  GG: "até 40 pessoas",
};

export const LEGACY_SERVINGS: Record<string, string> = {
  "Entre 8 y 10 personas": SERVE.P,
  "Hasta 15 personas": SERVE.M,
  "Hasta 25 personas": SERVE.G,
  "Hasta 40 personas": SERVE.GG,
};

const tamanhos = (p: number, m: number, g: number, gg: number): VariantSeed[] => [
  { name: "P", servings: SERVE.P, price: p },
  { name: "M", servings: SERVE.M, price: m },
  { name: "G", servings: SERVE.G, price: g },
  { name: "GG", servings: SERVE.GG, price: gg },
];
const unico = (price: number): VariantSeed[] => [{ name: "Único", price }];
const tamanhoG = (price: number): VariantSeed[] => [{ name: "G", servings: SERVE.G, price }];
const img = (f: string) => `/produtos/${f}.jpg`;

const personalizada = (name: string, legacy: string | undefined, image: string, description: string): ProductSeed => ({
  name,
  legacy,
  image: img(image),
  description,
  priceOnRequest: true,
  trackStock: false,
  variants: [{ name: "Sob consulta", price: 0 }],
});

export const CARDAPIO: CategorySeed[] = [
  {
    slug: "campeones",
    name: "Naked Cake",
    legacy: "Campeones de Ventas",
    group: "Tortas",
    description: "Naked cakes, os campeões de venda, em 4 tamanhos.",
    trackStock: false,
    products: [
      { name: "Torta Ninho com Chocolate", legacy: "Brigadeiro de Nido con Brigadeiro de Chocolate", description: "Brigadeiro de Ninho com brigadeiro de chocolate, massa de chocolate.", image: img("torta-ninho"), variants: tamanhos(120, 190, 230, 400) },
      { name: "Torta Beijinho com Chocolate", legacy: "Brigadeiro de Beijinho con Brigadeiro de Chocolate", description: "Beijinho (brigadeiro de coco) com brigadeiro de chocolate, massa de chocolate.", image: img("torta-beijinho"), variants: tamanhos(120, 190, 230, 400) },
      { name: "Torta Brigadeiro", legacy: "Brigadeiro de Chocolate", description: "Recheio e cobertura de brigadeiro de chocolate, massa de chocolate.", image: img("torta-brigadeiro"), variants: tamanhos(120, 190, 230, 400) },
      { name: "Torta Maracujá com Chocolate", legacy: "Brigadeiro de Maracuyá con Chocolate", description: "Brigadeiro de maracujá com brigadeiro de chocolate e geleia de maracujá.", image: img("torta-maracuja"), variants: tamanhos(130, 200, 260, 450) },
    ],
  },
  {
    slug: "tortas-premium",
    name: "Tortas Premium",
    group: "Tortas",
    description: "Tortas especiais tamanho G (até 25 pessoas).",
    trackStock: false,
    products: [
      { name: "Torta Avelã & Cereja", legacy: "Torta Avellana & Cereza", description: "Massa de chocolate, recheio de brigadeiro de avelã e cobertura fina de ganache de chocolate. Decorada com cerejas e avelãs.", image: img("premium-avela-cereja"), variants: tamanhoG(550) },
      { name: "Torta Coco Premium", legacy: "Torta Coco Premium", description: "Massa de chocolate, recheio de brigadeiro de coco e ganache blindada de brigadeiro de chocolate. Decorada com coco ralado e bolinhas de beijinho.", image: img("premium-coco"), variants: tamanhoG(375) },
      { name: "Torta Ninho Intenso", legacy: "Torta Nido Intenso", description: "Massa de chocolate, recheio de brigadeiro de Ninho com creme de avelã e ganache blindada de chocolate. Decorada com brigadeiro de Ninho, bolinhas de Ninho e morangos frescos.", image: img("premium-ninho-intenso"), variants: tamanhoG(500) },
      { name: "Torta Rosa Negra", legacy: "Torta Rosa Negra", description: "Massa de chocolate, recheio de brigadeiro de chocolate e brigadeiro de maracujá. Cobertura de brigadeiro de chocolate com pérolas de chocolate.", image: img("premium-rosa-negra"), variants: tamanhoG(400) },
      { name: "Torta Matilda Gula", legacy: "Matilda Gula", description: "Massa de chocolate, recheio e cobertura cremosa de brigadeiro de chocolate, decorada com bolinhas de brigadeiro.", image: img("premium-matilda"), variants: tamanhoG(420) },
    ],
  },
  {
    slug: "personalizadas",
    name: "Tortas Personalizadas",
    group: "Tortas",
    description: "Chantilly e ganache, sob encomenda. Preço sob consulta.",
    trackStock: false,
    products: [
      personalizada("Infantil", "Personalizada Infantil", "pers-infantil", "Diversão, cor e doçura para os pequenos."),
      personalizada("Temática", "Personalizada Temática", "pers-tematica", "Designs únicos que contam histórias."),
      personalizada("Temática Especial", undefined, "pers-tematica-2", "Designs únicos para datas especiais."),
      personalizada("Elegância Minimalista", "Personalizada Elegancia Minimalista", "pers-minimalista", "Beleza simples que impacta em cada detalhe."),
      personalizada("Pérolas de Elegância", "Personalizada Perlas de Elegancia", "pers-perolas-elegancia", "Clássica, delicada e sofisticada para qualquer ocasião."),
      personalizada("Amor em Cada Detalhe", "Personalizada Amor en cada Detalle", "pers-amor-detalhe", "Ideal para surpreender e celebrar com amor."),
      personalizada("Floral Colorida", undefined, "pers-floral", "Flores coloridas em chantilly."),
      personalizada("Floral Azul", "Personalizada Floral Azul", "pers-floral-azul", "Delicadeza em cada detalhe."),
      personalizada("Romântica", "Personalizada Romántica", "pers-romantica", "Suave, elegante e encantadora."),
      personalizada("Pérolas Douradas", "Personalizada Perlas Doradas", "pers-perolas-douradas", "Clássica, fina e sofisticada."),
      personalizada("Bosque", "Personalizada Bosque", "pers-bosque", "Intensa, úmida e cheia de sabor."),
      personalizada("Esportiva", "Personalizada Deportiva", "pers-esportiva", "Para os amantes do esporte e da energia."),
    ],
  },
  {
    slug: "cuchareables-clasicos",
    name: "Bolos de Pote Clássicos",
    legacy: "Cuchareables Clásicos",
    group: "Bolos de Pote",
    description: "Massa de chocolate. Bs 20.",
    trackStock: true,
    products: [
      { name: "Pote Ninho com Chocolate", legacy: "Cuchareable Nido con Brigadeiro de Chocolate", description: "Ninho com brigadeiro de chocolate.", image: img("pote-ninho"), variants: unico(20) },
      { name: "Pote Doce de Leite com Chocolate", legacy: "Cuchareable Dulce de Leche con Brigadeiro de Chocolate", description: "Doce de leite com brigadeiro de chocolate.", image: img("pote-doce-de-leite"), variants: unico(20) },
      { name: "Pote Brigadeiro", legacy: "Cuchareable Brigadeiro de Chocolate", description: "Brigadeiro de chocolate.", image: img("pote-brigadeiro"), variants: unico(20) },
      { name: "Pote Prestígio", legacy: "Cuchareable Prestigio", description: "Brigadeiro de chocolate com coco.", image: img("pote-prestigio"), variants: unico(20) },
      { name: "Pote Maracujá com Chocolate", legacy: "Cuchareable Maracuyá con Brigadeiro de Chocolate", description: "Maracujá com brigadeiro de chocolate.", image: img("pote-maracuja"), variants: unico(20) },
    ],
  },
  {
    slug: "cuchareables-premium",
    name: "Bolos de Pote Premium",
    legacy: "Cuchareables Premium",
    group: "Bolos de Pote",
    description: "Sabores especiais. Bs 25.",
    trackStock: true,
    products: [
      { name: "Pote Ninho com Morango", legacy: "Cuchareable Nido con Frutilla", description: "Ninho com geleia de morango, massa de baunilha.", image: img("pote-ninho-morango"), variants: unico(25) },
      { name: "Pote Ninho com Frutas Vermelhas", legacy: "Cuchareable Nido con Frutos Rojos", description: "Ninho com geleia de frutas vermelhas, massa de baunilha.", image: img("pote-ninho-frutas-vermelhas"), variants: unico(25) },
      { name: "Pote Cenoura com Chocolate", legacy: "Cuchareable Chocolate con Zanahoria", description: "Brigadeiro de chocolate com massa de cenoura.", image: img("pote-cenoura"), variants: unico(25) },
      { name: "Pote Moca (Café)", legacy: "Cuchareable Moca", description: "Brigadeiro de moca (café) com massa de chocolate.", image: img("pote-moca"), variants: unico(25) },
    ],
  },
];

/**
 * Categorias e produtos que aparecem no PedidosYa mas não estavam no cardápio PDF.
 * Entram com onStore=false e o preço do PedidosYa como referência: os sócios definem
 * o preço da loja e ativam "Vende na loja" pelo painel.
 */
export const EXTRAS: CategorySeed[] = [
  {
    slug: "campeones",
    name: "Naked Cake",
    group: "Tortas",
    trackStock: false,
    products: [
      { name: "Torta Prestígio", description: "Massa de chocolate, coco com brigadeiro de chocolate.", onStore: false, variants: [{ name: "P", servings: SERVE.P, price: 144 }] },
      { name: "Torta Prestígio Decorada", description: "Massa de chocolate, coco e brigadeiro de chocolate, decorada com bolinhas de beijinho.", onStore: false, variants: [{ name: "P", servings: SERVE.P, price: 175 }] },
      { name: "Torta Brigadeiro com Doce de Leite", description: "Massa de chocolate, brigadeiro de chocolate com doce de leite.", onStore: false, variants: [{ name: "P", servings: SERVE.P, price: 175 }] },
      { name: "Torta Ninho com Geleia de Morango", description: "Brigadeiro de Ninho com geleia de morango e chocolate.", onStore: false, variants: [{ name: "P", servings: SERVE.P, price: 200 }] },
      { name: "Torta Doce de Leite com Chocolate", description: "Recheio de doce de leite com brigadeiro de chocolate e cobertura de Ninho.", onStore: false, variants: [{ name: "P", servings: SERVE.P, price: 144 }] },
      { name: "Torta Limão com Frutas Vermelhas", description: "Massa suave, brigadeiro de limão e geleia de frutas vermelhas.", onStore: false, variants: [{ name: "P", servings: SERVE.P, price: 160 }] },
    ],
  },
  {
    slug: "cuchareables-clasicos",
    name: "Bolos de Pote Clássicos",
    group: "Bolos de Pote",
    trackStock: true,
    products: [
      { name: "Pote Sabor à Escolha", description: "Bolo de pote com sabor escolhido pelo cliente.", onStore: false, variants: unico(22) },
    ],
  },
  {
    slug: "fatias",
    name: "Fatias de Torta",
    group: "Tortas",
    description: "Porções individuais de torta (~250 g).",
    trackStock: true,
    products: [
      { name: "Fatia Ninho com Morango", description: "Brigadeiro de Ninho ou geleia de morango, cobertura de chocolate.", onStore: false, variants: unico(30) },
      { name: "Fatia Maracujá", description: "Mousse de maracujá, recheio com geleia de maracujá e cobertura de brigadeiro de chocolate.", onStore: false, variants: unico(35) },
      { name: "Fatia Baunilha com Frutas Vermelhas", description: "Ninho com geleia de frutas vermelhas, massa de baunilha.", onStore: false, variants: unico(40) },
      { name: "Fatia Prestígio", description: "Recheio cremoso de coco e brigadeiro, cobertura de chocolate.", onStore: false, variants: unico(35) },
      { name: "Fatia Cenoura com Chocolate", description: "Bolo de cenoura com cobertura de chocolate.", onStore: false, variants: unico(35) },
    ],
  },
  {
    slug: "empadoes",
    name: "Empadões",
    group: "Salgados",
    description: "Empadões prontos.",
    trackStock: true,
    products: [
      {
        name: "Empadão de Frango",
        description: "Frango com requeijão.",
        onStore: false,
        variants: [
          { name: "P", servings: "250 g", price: 25 },
          { name: "M", servings: "750 g", price: 88 },
        ],
      },
      { name: "Empadão de Fricassê", description: "Fricassê de frango, massa leve.", onStore: false, variants: [{ name: "M", servings: "750 g", price: 88 }] },
    ],
  },
  {
    slug: "combos",
    name: "Combos",
    group: "Combos",
    description: "Combinações de produtos (sem controle de estoque próprio).",
    trackStock: false,
    products: [
      { name: "Combo Porção Ninho com Morango", description: "1 empadão 250 g + Coca-Cola 300 ml + 1 fatia de torta Ninho com morango.", onStore: false, variants: unico(70) },
      { name: "Combo Porção Ninho com Frutas Vermelhas", description: "1 empadão 250 g + Coca-Cola 300 ml + 1 fatia Ninho com frutas vermelhas.", onStore: false, variants: unico(70) },
      { name: "Combo Porção Maracujá com Chocolate", description: "1 empadão 250 g + Coca-Cola 300 ml + 1 fatia de maracujá com chocolate.", onStore: false, variants: unico(70) },
      { name: "Combo Porção Prestígio", description: "1 empadão 250 g + Coca-Cola 300 ml + 1 fatia de prestígio.", onStore: false, variants: unico(70) },
      { name: "Combo Porção Cenoura com Chocolate", description: "1 empadão 250 g + Coca-Cola 300 ml + 1 fatia de cenoura com chocolate.", onStore: false, variants: unico(70) },
      { name: "Combo Empadão", description: "2 empadões M + Coca-Cola 2 L + 2 docinhos sortidos.", onStore: false, variants: unico(188) },
      { name: "Combo Festa P", description: "Torta P (10 pessoas) + docinhos sortidos + Coca-Cola 2 L.", onStore: false, variants: unico(0) },
    ],
  },
  {
    slug: "docinhos",
    name: "Docinhos e Kits de Festa",
    group: "Doces",
    description: "Brigadeiros, beijinhos e kits para festa.",
    trackStock: true,
    products: [],
  },
  {
    slug: "bebidas",
    name: "Bebidas",
    group: "Bebidas e Acessórios",
    trackStock: true,
    products: [
      {
        name: "Coca-Cola",
        onStore: false,
        variants: [
          { name: "300 ml", price: 7 },
          { name: "500 ml", price: 12 },
          { name: "2 L", price: 20 },
        ],
      },
      { name: "Fanta Laranja", onStore: false, variants: [{ name: "300 ml", price: 7 }] },
      { name: "Fanta Guaraná", onStore: false, variants: [{ name: "300 ml", price: 7 }] },
      { name: "Sprite", onStore: false, variants: [{ name: "300 ml", price: 6 }] },
    ],
  },
  {
    slug: "velas",
    name: "Velas e Toppers",
    group: "Bebidas e Acessórios",
    trackStock: true,
    products: [
      { name: "Vela Estrela", onStore: false, variants: unico(9) },
      { name: "Vela Dourada", onStore: false, variants: unico(5) },
      { name: "Vela Lisa", onStore: false, variants: unico(5) },
      {
        name: "Vela Vulcão",
        onStore: false,
        variants: [
          { name: "P", price: 10 },
          { name: "G", price: 13 },
        ],
      },
    ],
  },
];
