"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type PyState = { error?: string; ok?: string } | null;

const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};

export async function updatePedidosYaItem(_: PyState, form: FormData): Promise<PyState> {
  await requireSession();
  const id = String(form.get("id"));
  const price = money(form.get("price"));
  const listPrice = money(form.get("listPrice"));
  if (price === null || Number.isNaN(price)) return { error: "Preço inválido." };
  if (Number.isNaN(listPrice)) return { error: "Preço “de” inválido." };
  await prisma.pedidosYaItem.update({
    where: { id },
    data: {
      price,
      listPrice: listPrice && listPrice > price ? listPrice : null,
      active: form.get("active") === "on",
      needsReview: false,
    },
  });
  revalidatePath("/painel", "layout");
  return { ok: "Salvo" };
}
