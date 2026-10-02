import { prisma } from "@/lib/db";
import { agentAuthorized, unauthorized } from "@/lib/agent-auth";
import { InventoryError, createSale } from "@/lib/inventory";

export const dynamic = "force-dynamic";

type Body = {
  itens?: { variantId?: string; quantidade?: number; precoUnitario?: number }[];
  cliente?: string;
  telefone?: string;
  observacao?: string;
  /** Id do aviso do agente: a mesma referência nunca gera 2 vendas. */
  ref?: string;
};

// Registra uma venda do agente do WhatsApp (canal WHATSAPP, pagamento QR),
// com a mesma regra do painel: preço, custo e baixa de estoque.
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return unauthorized();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

  const ref = String(body.ref ?? "").trim().slice(0, 120) || undefined;
  if (ref) {
    const existente = await prisma.sale.findFirst({ where: { externalRef: ref } });
    if (existente) {
      return Response.json({
        ok: true,
        duplicada: true,
        venda: { id: existente.id, numero: existente.number, total: Number(existente.total) },
      });
    }
  }

  const itens = (Array.isArray(body.itens) ? body.itens : [])
    .filter((i) => i && typeof i.variantId === "string")
    .map((i) => ({
      variantId: i.variantId as string,
      quantity: Math.round(Number(i.quantidade ?? 0)),
      unitPrice:
        i.precoUnitario === undefined || i.precoUnitario === null ? undefined : Number(i.precoUnitario),
    }));

  try {
    const sale = await createSale({
      items: itens,
      channel: "WHATSAPP",
      payment: "QR",
      customerName: texto(body.cliente, 120),
      customerPhone: texto(body.telefone, 60)?.replace(/\D/g, "").slice(0, 20),
      notes: texto(body.observacao, 1000),
      externalRef: ref,
    });
    return Response.json({
      ok: true,
      duplicada: false,
      venda: { id: sale.id, numero: sale.number, total: Number(sale.total) },
    });
  } catch (e) {
    if (e instanceof InventoryError) {
      return Response.json({ ok: false, error: e.message }, { status: 409 });
    }
    console.error("[api/agente/vendas]", e);
    return Response.json({ ok: false, error: "Erro ao registrar a venda." }, { status: 500 });
  }
}
