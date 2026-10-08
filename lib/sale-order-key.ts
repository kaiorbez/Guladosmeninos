export function saleOrderKey(sale: { id: string; externalRef: string | null }, payments: Map<string, string>) {
  const ref = sale.externalRef || "";
  if (ref.startsWith("encomenda-pagamento:")) {
    const id = payments.get(ref.slice("encomenda-pagamento:".length));
    return id ? `order:${id}` : `sale:${sale.id}`;
  }
  return ref.startsWith("encomenda:") ? `order:${ref.slice("encomenda:".length)}` : `sale:${sale.id}`;
}
