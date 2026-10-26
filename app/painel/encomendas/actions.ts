"use server";

import type { OrderStatus, PaymentMethod, SaleChannel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setOrderProduced } from "@/lib/order-production";
import { recordOrderActivity } from "@/lib/order-history";
import { InventoryError } from "@/lib/inventory";
import { OrderError, addPayment, bookPayment, deliverOrder, removePayment, undoAllOrderSales, undoOrderSale } from "@/lib/orders";
import { syncOrderStock } from "@/lib/order-stock";

const STATUSES: OrderStatus[] = ["PENDENTE", "ENTREGUE", "CANCELADA"];
const CHANNELS: SaleChannel[] = ["BALCAO", "WHATSAPP", "DELIVERY", "INSTAGRAM", "PEDIDOSYA"];
const METHODS: PaymentMethod[] = ["QR", "EFECTIVO", "TARJETA", "OTRO"];

export async function setOrderProducedAction(form: FormData) {
  const session = await requireSession();
  const id = String(form.get("orderId") ?? "").trim();
  const produced = form.get("produced");
  if (!id || (produced !== "1" && produced !== "0")) return;
  const result = await setOrderProduced(id, produced === "1", session.userId);
  if (!result.count) throw new OrderError("O pedido já foi atualizado. Confira a situação atual.");
  revalidatePath("/painel", "layout");
}

const method = (v: FormDataEntryValue | null): PaymentMethod => (METHODS.includes(v as PaymentMethod) ? (v as PaymentMethod) : "QR");
const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  return s === "" ? 0 : Number(s);
};

export async function saveOrderAction(_: string | null, form: FormData): Promise<string | null> {
  const session = await requireSession();
  const text = (key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);

  const date = text("deliveryDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Informe o dia da entrega.";
  const customerName = text("customerName");
  if (!customerName) return "Informe o nome do cliente.";
  const product = text("product", 1000);
  if (!product) return "Informe os produtos.";
  const total = money(form.get("total"));
  if (!(total >= 0)) return "Valor total inválido.";
  const channel = CHANNELS.includes(text("channel") as SaleChannel) ? (text("channel") as SaleChannel) : "WHATSAPP";

  const data = {
    deliveryDate: new Date(`${date}T00:00:00Z`),
    deliveryTime: form.get("paraAgora") === "1" ? "AGORA" : text("deliveryTime", 5) || null,
    customerName,
    customerPhone: text("customerPhone", 30).replace(/\D/g, "") || null,
    product,
    dough: text("dough") || null,
    filling: text("filling") || null,
    topping: text("topping") || null,
    decoration: text("decoration") || null,
    total,
    notes: text("notes", 1000) || null,
    channel,
  };

  // Foto da decoração: vem do navegador já reduzida (data URL); "remover" apaga a atual.
  const photoData = String(form.get("decorationPhoto") ?? "");
  let photo: { decorationPhoto: Uint8Array<ArrayBuffer> | null; decorationPhotoType: string | null; decorationPhotoAt: Date | null } | undefined;
  if (photoData) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photoData);
    const bytes = m ? Buffer.from(m[2], "base64") : null;
    if (!m || !bytes || bytes.length > 1_500_000) return "Foto da decoração inválida ou grande demais.";
    photo = { decorationPhoto: new Uint8Array(bytes), decorationPhotoType: m[1], decorationPhotoAt: new Date() };
  } else if (form.get("decorationPhotoRemove") === "1") {
    photo = { decorationPhoto: null, decorationPhotoType: null, decorationPhotoAt: null };
  }

  const id = text("id");
  if (id) {
    const current = await prisma.order.findUnique({ where: { id } });
    if (!current) return "Encomenda não encontrada.";
    if (total < Number(current.paid)) return "O total não pode ser menor que o valor já pago.";
    await prisma.order.update({ where: { id }, data: { ...data, ...photo, agentVersion: { increment: 1 } } });
  } else {
    // Na criação, o valor pago vira o primeiro pagamento (o sinal).
    const paid = money(form.get("paid"));
    if (!(paid >= 0)) return "Valor pago inválido.";
    if (paid > total) return "O valor pago não pode ser maior que o total.";
    const created = await prisma.order.create({
      data: {
        ...data,
        ...photo,
        paid,
        userId: session.userId,
        payments: paid > 0 ? { create: { amount: paid, method: method(form.get("paidMethod")) } } : undefined,
      },
      include: { payments: true },
    });
    // O sinal entra no faturamento na hora.
    for (const p of created.payments) await bookPayment(p.id, session.userId);
    // "Registrar e adicionar outro": abre outra ficha já com os dados do mesmo cliente.
    if (form.get("next") === "outro") {
      revalidatePath("/painel", "layout");
      redirect(`/painel/encomendas/nova?cliente=${created.id}`);
    }
  }

  revalidatePath("/painel", "layout");
  redirect("/painel/encomendas");
}

export async function setOrderStatusAction(form: FormData) {
  const session = await requireSession();
  const status = String(form.get("status")) as OrderStatus;
  if (!STATUSES.includes(status)) throw new OrderError("Situação inválida.");
  const order = await prisma.order.findUnique({ where: { id: String(form.get("orderId")) } });
  if (!order) throw new OrderError("Encomenda não encontrada.");
  if (order.status === status) throw new OrderError("O pedido já está nesta situação. Atualize a página.");

  try {
    if (status === "ENTREGUE") {
      await deliverOrder(order.id, session.userId, method(form.get("method")));
    } else {
      // Saindo de "entregue": a venda gerada na entrega é cancelada.
      await undoOrderSale(order.saleId, session.userId);
      await prisma.$transaction(async tx => {
        await tx.order.update({ where: { id: order.id }, data: { status, saleId: null } });
        await syncOrderStock(tx, order.id, { userId: session.userId });
        await recordOrderActivity(tx, order.id, status === "CANCELADA" ? "Encomenda cancelada" : "Retornado para pendente", session.userId);
      });
    }
  } catch (e) {
    throw e;
  }
  revalidatePath("/painel", "layout");
}

/** Apaga a encomenda de vez (para registros feitos por engano). */
export async function deleteOrderAction(form: FormData) {
  const session = await requireSession();
  const order = await prisma.order.findUnique({ where: { id: String(form.get("orderId")) } });
  if (!order) return;
  await undoAllOrderSales(order.id, session.userId);
  await prisma.$transaction(tx => syncOrderStock(tx, order.id, { release: true, userId: session.userId }));
  await prisma.order.delete({ where: { id: order.id } });
  revalidatePath("/painel", "layout");
}

/** Registra um valor recebido (o card manda o restante; a ficha permite valor parcial). */
export async function addPaymentAction(_: string | null, form: FormData): Promise<string | null> {
  const session = await requireSession();
  try {
    await addPayment(String(form.get("orderId")), money(form.get("amount")), method(form.get("method")), session.userId);
  } catch (e) {
    if (e instanceof OrderError) return e.message;
    throw e;
  }
  revalidatePath("/painel", "layout");
  return null;
}

/** Versão sem retorno, para os botões do card. */
export async function payRestAction(form: FormData) {
  const error = await addPaymentAction(null, form);
  if (error) throw new OrderError(error);
}

export async function performOrderAction(form: FormData): Promise<{ ok: boolean; message: string }> {
  await requireSession();
  try {
    const action = form.get("operation");
    if (action === "produced") await setOrderProducedAction(form);
    else if (action === "status") await setOrderStatusAction(form);
    else if (action === "pay") await payRestAction(form);
    else if (action === "delete") await deleteOrderAction(form);
    else return {ok:false,message:"Ação inválida."};
    return {ok:true,message:action === "pay" ? "Pagamento registrado." : action === "delete" ? "Encomenda excluída." : "Pedido atualizado."};
  } catch (e) {
    return {ok:false,message:e instanceof OrderError || e instanceof InventoryError ? e.message : "Não foi possível concluir. Atualize a página e confira o pedido antes de tentar novamente."};
  }
}

export async function deletePaymentAction(form: FormData) {
  const session = await requireSession();
  await removePayment(String(form.get("paymentId")), session.userId);
  revalidatePath("/painel", "layout");
}

