export const RETIRED_COMBOS = ['Combo Porção Ninho com Morango', 'Combo Porção Ninho com Frutas Vermelhas', 'Combo Porção Maracujá com Chocolate', 'Combo Porção Prestígio', 'Combo Porção Cenoura com Chocolate', 'Combo Bolo de Pote'];
export const POTS_PROMO = 'Combo 3 Bolos de Pote - 9 a 11 outubro 2026';
export const SLICES_PROMO = 'Promo 2 Fatias Ninho com Frutas Vermelhas - 17 e 18 outubro 2026';
/** Janela inclusiva pelo dia local da loja; a cobrança não depende da memória da IA. */
export function promotionAvailable(name: string, now = new Date()) {
  if (RETIRED_COMBOS.includes(name)) return false;
  if (name !== POTS_PROMO && name !== SLICES_PROMO) return true;
  const day = new Date(now.getTime() - 4 * 3600000).toISOString().slice(0, 10);
  if (name === SLICES_PROMO) return day >= '2026-10-17' && day <= '2026-10-18';
  return day >= '2026-10-09' && day <= '2026-10-11';
}
