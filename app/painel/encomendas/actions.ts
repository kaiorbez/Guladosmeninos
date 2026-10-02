"use server";

import type { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STATUSES: OrderStatus[] = ["PENDENTE", "ENTREGUE", "CANCELADA"];

export async function saveOrderAction(_: string | null, form: FormData): Promise<string | null> {
  const session = await requireSession();
  const text = (key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);
  const money = (key: string) => {
    const s = text(key).replace(",", ".");
    return s === "" ? 0 : Number(s);
  };

  const date = text("deliveryDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Informe o dia da entrega.";
  const customerName = text("customerName");
  if (!customerName) return "Informe o nome do cliente.";
  const product = text("product");
  if (!product) return "Informe o produto.";
  const total = money("total");
  const paid = money("paid");
  if (!(total >= 0) || !(paid >= 0)) return "Valor inválido.";
  if (paid > total) return "O valor pago não pode ser maior que o total.";

  const data = {
    deliveryDate: new Date(`${date}T00:00:00Z`),
    deliveryTime: text("deliveryTime", 5) || null,
    customerName,
    customerPhone: text("customerPhone", 30) || null,
    product,
    dough: text("dough") || null,
    filling: text("filling") || null,
    topping: text("topping") || null,
    decoration: text("decoration") || null,
    total,
    paid,
    notes: text("notes", 1000) || null,
  };

  const id = text("id");
  if (id) await prisma.order.update({ where: { id }, data });
  else await prisma.order.create({ data: { ...data, userId: session.userId } });

  revalidatePath("/painel", "layout");
  redirect("/painel/encomendas");
}

export async function setOrderStatusAction(form: FormData) {
  await requireSession();
  const status = String(form.get("status")) as OrderStatus;
  if (!STATUSES.includes(status)) return;
  await prisma.order.updateMany({ where: { id: String(form.get("orderId")) }, data: { status } });
  revalidatePath("/painel", "layout");
}

/** Marca o restante como recebido (valor pago = total). */
export async function payOrderAction(form: FormData) {
  await requireSession();
  const order = await prisma.order.findUnique({ where: { id: String(form.get("orderId")) } });
  if (!order) return;
  await prisma.order.update({ where: { id: order.id }, data: { paid: order.total } });
  revalidatePath("/painel", "layout");
}
