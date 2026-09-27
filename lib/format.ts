export const TZ = "America/La_Paz";

type Num = number | string | { toString(): string };

export function toNumber(v: Num) {
  return typeof v === "number" ? v : Number(v.toString());
}

export function bs(v: Num) {
  const n = toNumber(v);
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return `Bs ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function dateTime(d: Date) {
  return d.toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

export function variantLabel(productName: string, variantName: string) {
  return variantName === "Único" ? productName : `${productName} (${variantName})`;
}

export const CHANNEL_LABEL: Record<string, string> = {
  BALCAO: "Balcão",
  WHATSAPP: "WhatsApp",
  DELIVERY: "Delivery",
  INSTAGRAM: "Instagram",
};

export const PAYMENT_LABEL: Record<string, string> = {
  QR: "QR",
  EFECTIVO: "Dinheiro",
  TARJETA: "Cartão",
  OTRO: "Outro",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  ENTRADA: "Produção / entrada",
  SAIDA: "Perda / saída",
  AJUSTE: "Ajuste de contagem",
  VENDA: "Venda",
  ESTORNO: "Venda cancelada",
};
