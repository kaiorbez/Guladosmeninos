// Bolívia (America/La_Paz) é UTC-4 o ano todo, sem horário de verão.
// O servidor (Railway) roda em UTC, então os limites de "hoje", "semana" etc.
// são calculados no fuso de La Paz.
const OFFSET_MS = 4 * 60 * 60 * 1000;

/** Início do dia em La Paz, deslocado `daysAgo` dias para trás. */
export function startOfDay(daysAgo = 0, now = new Date()) {
  const local = new Date(now.getTime() - OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - daysAgo);
  return new Date(local.getTime() + OFFSET_MS);
}

/** Início do mês corrente em La Paz. */
export function startOfMonth(now = new Date()) {
  const local = new Date(now.getTime() - OFFSET_MS);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + OFFSET_MS);
}

/** Chave YYYY-MM-DD do dia em La Paz. */
export function dayKey(d: Date) {
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}
