// Cardápio da Gula dos Meninos no PedidosYa (Santa Cruz), lido de print/PDF em set/2026.
// `product`/`variant` ligam o anúncio ao item do painel (baixa de estoque e comparação
// de preço). `review` = preço lido com baixa resolução: conferir no app.

export type PedidosYaSeed = {
  section: string;
  name: string;
  description?: string;
  price: number;
  listPrice?: number;
  product: string;
  variant: string;
  review?: boolean;
};

export const PEDIDOSYA: PedidosYaSeed[] = [
  // Tortas
  { section: "Tortas", name: "Prestigio", description: "Torta P, até 10 pessoas, massa de chocolate, coco com brigadeiro de chocolate.", price: 129.6, listPrice: 144, product: "Torta Prestígio", variant: "P" },
  { section: "Tortas", name: "Brigadeiro de nido", description: "Torta P, até 10 pessoas, brigadeiro de Ninho com brigadeiro de chocolate.", price: 129.6, listPrice: 144, product: "Torta Ninho com Chocolate", variant: "P" },
  { section: "Tortas", name: "Torta p - prestigio (coco y chocolate)", price: 175, product: "Torta Prestígio Decorada", variant: "P" },
  { section: "Tortas", name: "Brigadeiro de chocolate", price: 157, product: "Torta Brigadeiro", variant: "P" },
  { section: "Tortas", name: "Torta p - brigadeiro y dulce de leche", price: 175, product: "Torta Brigadeiro com Doce de Leite", variant: "P" },
  { section: "Tortas", name: "Brigadeiro con mermelada", price: 200, product: "Torta Ninho com Geleia de Morango", variant: "P" },
  { section: "Tortas", name: "Brigadeiro chocolate y nido", price: 157, product: "Torta Ninho com Chocolate", variant: "P" },
  { section: "Tortas", name: "Nido y chocolate", price: 188, product: "Torta Ninho com Chocolate", variant: "P" },
  { section: "Tortas", name: "Chocolate con nido", price: 157, product: "Torta Ninho com Chocolate", variant: "P" },
  { section: "Tortas", name: "Dulce de leche con chocolate", price: 144, product: "Torta Doce de Leite com Chocolate", variant: "P" },
  { section: "Tortas", name: "Brigadeiro de nido con chocolate - m", price: 222.3, listPrice: 247, product: "Torta Ninho com Chocolate", variant: "M" },
  { section: "Tortas", name: "Torta p - limón con mermelada de frutos rojos", price: 160, product: "Torta Limão com Frutas Vermelhas", variant: "P" },

  // Combos
  { section: "Combos", name: "Combo porción", price: 63, listPrice: 70, product: "Combo Porção Ninho com Morango", variant: "Único" },
  { section: "Combos", name: "Combo fiesta p", price: 0, product: "Combo Festa P", variant: "Único", review: true },
  { section: "Combos", name: "Combo porción - nido con frutos rojos", price: 63, listPrice: 70, product: "Combo Porção Ninho com Frutas Vermelhas", variant: "Único", review: true },
  { section: "Combos", name: "Combo porción - maracuyá con chocolate", price: 63, listPrice: 70, product: "Combo Porção Maracujá com Chocolate", variant: "Único" },
  { section: "Combos", name: "Combo porción - prestigio", price: 63, listPrice: 70, product: "Combo Porção Prestígio", variant: "Único" },
  { section: "Combos", name: "Combo empadão", price: 188, product: "Combo Empadão", variant: "Único" },
  { section: "Combos", name: "Combo porción - zanahoria con chocolate", price: 63, listPrice: 70, product: "Combo Porção Cenoura com Chocolate", variant: "Único" },

  // Postres
  { section: "Fatias", name: "Porción de torta", price: 30, product: "Fatia Ninho com Morango", variant: "Único" },
  { section: "Fatias", name: "Porción de torta (maracuyá)", price: 35, product: "Fatia Maracujá", variant: "Único" },
  { section: "Fatias", name: "Porción de torta (vainilla)", price: 40, product: "Fatia Baunilha com Frutas Vermelhas", variant: "Único" },
  { section: "Fatias", name: "Porción de prestigio", price: 35, product: "Fatia Prestígio", variant: "Único" },
  { section: "Fatias", name: "Porción de torta (zanahoria)", price: 35, product: "Fatia Cenoura com Chocolate", variant: "Único" },

  // Salgado
  { section: "Salgados", name: "Empadão p - frango", price: 25, product: "Empadão de Frango", variant: "P" },
  { section: "Salgados", name: "Empadão m - frango", price: 88, product: "Empadão de Frango", variant: "M" },
  { section: "Salgados", name: "Empadão m - fricassê", price: 88, product: "Empadão de Fricassê", variant: "M", review: true },

  // Cuchareables
  { section: "Bolos de Pote", name: "Cuchareable brigadeiro", price: 24, product: "Pote Brigadeiro", variant: "Único" },
  { section: "Bolos de Pote", name: "Cuchareable dulce de leche", price: 22, product: "Pote Doce de Leite com Chocolate", variant: "Único" },
  { section: "Bolos de Pote", name: "Cuchareable prestigio", price: 22, product: "Pote Prestígio", variant: "Único" },
  { section: "Bolos de Pote", name: "Cuchareable nido y brigadeiro", price: 24, product: "Pote Ninho com Chocolate", variant: "Único" },
  { section: "Bolos de Pote", name: "Cuchareable maracuyá", price: 26, product: "Pote Maracujá com Chocolate", variant: "Único" },
  { section: "Bolos de Pote", name: "Cuchareable frutas rojas", price: 26, product: "Pote Ninho com Frutas Vermelhas", variant: "Único" },
  { section: "Bolos de Pote", name: "Torta cuchareable", price: 22, product: "Pote Sabor à Escolha", variant: "Único" },

  // Bebidas
  { section: "Bebidas", name: "Coca-Cola 300 ml", price: 7, product: "Coca-Cola", variant: "300 ml" },
  { section: "Bebidas", name: "Coca-Cola 500 ml", price: 12, product: "Coca-Cola", variant: "500 ml" },
  { section: "Bebidas", name: "Coca-Cola 2 L", price: 20, product: "Coca-Cola", variant: "2 L" },
  { section: "Bebidas", name: "Fanta Naranja 300 ml", price: 7, product: "Fanta Laranja", variant: "300 ml" },
  { section: "Bebidas", name: "Fanta Guaraná 300 ml", price: 7, product: "Fanta Guaraná", variant: "300 ml" },
  { section: "Bebidas", name: "Sprite Lima Limón 300 ml", price: 6, product: "Sprite", variant: "300 ml" },

  // Topper de torta
  { section: "Velas e Toppers", name: "Vela de estrella", price: 9, product: "Vela Estrela", variant: "Único" },
  { section: "Velas e Toppers", name: "Vela dorada", price: 5, product: "Vela Dourada", variant: "Único" },
  { section: "Velas e Toppers", name: "Vela lisa", price: 5, product: "Vela Lisa", variant: "Único" },
  { section: "Velas e Toppers", name: "Vela p - volcánica", price: 10, product: "Vela Vulcão", variant: "P" },
  { section: "Velas e Toppers", name: "Vela g - volcánica", price: 13, product: "Vela Vulcão", variant: "G" },
];
