"use server";

import type { PaymentMethod, SaleChannel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InventoryError, cancelSale, createSale, type SaleItemInput } from "@/lib/inventory";

const CHANNELS: SaleChannel[] = ["BALCAO", "WHATSAPP", "DELIVERY", "INSTAGRAM", "PEDIDOSYA"];
const PAYMENTS: PaymentMethod[] = ["QR", "EFECTIVO", "TARJETA", "OTRO"];

export async function createSaleAction(_: string | null, form: FormData): Promise<string | null> {
  const session = await requireSession();
  let items: SaleItemInput[];
  try {
    const raw = JSON.parse(String(form.get("items") ?? "[]")) as unknown[];
    items = raw.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        variantId: String(o.variantId),
        quantity: Number(o.quantity),
        unitPrice: o.unitPrice === undefined ? undefined : Number(o.unitPrice),
      };
    });
  } catch {
    return "Itens inválidos.";
  }

  const channel = String(form.get("channel")) as SaleChannel;
  const payment = String(form.get("payment")) as PaymentMethod;
  if (!CHANNELS.includes(channel) || !PAYMENTS.includes(payment)) return "Canal ou pagamento inválido.";

  let number: number;
  try {
    const sale = await createSale({
      items,
      channel,
      payment,
      customerName: String(form.get("customerName") ?? "").trim(),
      customerPhone: String(form.get("customerPhone") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
      userId: session.userId,
    });
    number = sale.number;
  } catch (e) {
    if (e instanceof InventoryError) return e.message;
    throw e;
  }

  revalidatePath("/painel", "layout");
  redirect(`/painel/vendas?registrada=${number}`);
}

/** Apaga a venda de vez. Se ainda estava confirmada, antes devolve os itens ao estoque. */
export async function deleteSaleAction(form: FormData) {
  const session = await requireSession();
  const sale = await prisma.sale.findUnique({ where: { id: String(form.get("saleId")) } });
  if (!sale) return;
  if (sale.status === "CONFIRMADA") await cancelSale(sale.id, session.userId);
  // Encomenda que gerou esta venda deixa de apontar para ela.
  await prisma.order.updateMany({ where: { saleId: sale.id }, data: { saleId: null } });
  await prisma.sale.delete({ where: { id: sale.id } });
  revalidatePath("/painel", "layout");
}

export async function cancelSaleAction(form: FormData) {
  const session = await requireSession();
  try {
    await cancelSale(String(form.get("saleId")), session.userId);
  } catch (e) {
    if (!(e instanceof InventoryError)) throw e;
  }
  revalidatePath("/painel", "layout");
}
