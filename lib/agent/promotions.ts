export const POTS_PROMO = 'Combo 3 Bolos de Pote - 9 a 11 outubro 2026';
/** Janela inclusiva pelo dia local da loja; a cobrança não depende da memória da IA. */
export function promotionAvailable(name: string, now = new Date()) {
  if (name !== POTS_PROMO) return true;
  const day = new Date(now.getTime() - 4 * 3600000).toISOString().slice(0, 10);
  return day >= '2026-10-09' && day <= '2026-10-11';
}
