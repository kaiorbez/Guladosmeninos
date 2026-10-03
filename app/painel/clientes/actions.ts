"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Tira o cliente da lista (vendas e encomendas dele continuam como estão). */
export async function hideClientAction(form: FormData) {
  await requireSession();
  const key = String(form.get("key") ?? "").slice(0, 200);
  if (!key) return;
  const name = String(form.get("name") ?? "").slice(0, 200) || null;
  await prisma.hiddenClient.upsert({ where: { key }, update: { name }, create: { key, name } });
  revalidatePath("/painel/clientes");
}

export async function restoreClientAction(form: FormData) {
  await requireSession();
  await prisma.hiddenClient.deleteMany({ where: { key: String(form.get("key") ?? "") } });
  revalidatePath("/painel/clientes");
}
