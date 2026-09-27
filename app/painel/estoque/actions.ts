"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InventoryError, moveStock } from "@/lib/inventory";

export type ActionState = { error?: string; ok?: string } | null;

function toInt(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) ? n : NaN;
}

function toMoney(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export async function moveStockAction(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  const type = String(form.get("type"));
  if (type !== "ENTRADA" && type !== "SAIDA" && type !== "AJUSTE") return { error: "Operação inválida." };
  const quantity = toInt(form.get("quantity"));
  if (Number.isNaN(quantity)) return { error: "Digite um número inteiro." };

  try {
    const after = await moveStock({
      variantId: String(form.get("variantId")),
      type,
      quantity,
      note: String(form.get("note") ?? "").trim() || undefined,
      userId: session.userId,
    });
    revalidatePath("/painel", "layout");
    return { ok: `Estoque: ${after}` };
  } catch (e) {
    if (e instanceof InventoryError) return { error: e.message };
    throw e;
  }
}

/** Foto vinda do navegador já reduzida para JPEG (data URL). null = inválida. */
function parsePhoto(dataUrl: string) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 1_500_000) return null;
  return { photo: new Uint8Array(bytes), photoType: m[1], photoUpdatedAt: new Date() };
}

/** Troca só a foto do produto (clique na miniatura da lista de estoque). */
export async function setProductPhotoAction(productId: string, dataUrl: string): Promise<ActionState> {
  await requireSession();
  const photo = parsePhoto(dataUrl);
  if (!photo) return { error: "Foto inválida ou grande demais." };
  await prisma.product.update({ where: { id: productId }, data: photo });
  revalidatePath("/painel", "layout");
  return { ok: "Foto atualizada." };
}

type VariantRow = {
  id?: string;
  name: string;
  servings: string | null;
  price: number;
  cost: number;
  minStock: number;
  active: boolean;
};

export async function saveProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const id = String(form.get("id") ?? "") || undefined;
  const name = String(form.get("name") ?? "").trim();
  const categoryId = String(form.get("categoryId") ?? "");
  if (!name) return { error: "Dê um nome ao produto." };
  if (!categoryId) return { error: "Escolha a categoria." };

  const product = {
    name,
    categoryId,
    description: String(form.get("description") ?? "").trim() || null,
    trackStock: form.get("trackStock") === "on",
    onStore: form.get("onStore") === "on",
    priceOnRequest: form.get("priceOnRequest") === "on",
    active: form.get("active") === "on",
  };

  const photoData = String(form.get("photoData") ?? "");
  const photo = photoData ? parsePhoto(photoData) : undefined;
  if (photo === null) return { error: "Foto inválida ou grande demais." };

  const count = toInt(form.get("variantCount"));
  const variants: VariantRow[] = [];
  for (let i = 0; i < count; i++) {
    const vName = String(form.get(`v${i}.name`) ?? "").trim();
    if (!vName) continue;
    const row: VariantRow = {
      id: String(form.get(`v${i}.id`) ?? "") || undefined,
      name: vName,
      servings: String(form.get(`v${i}.servings`) ?? "").trim() || null,
      price: toMoney(form.get(`v${i}.price`)),
      cost: toMoney(form.get(`v${i}.cost`) || "0"),
      minStock: toInt(form.get(`v${i}.minStock`) || "0"),
      active: form.get(`v${i}.active`) === "on",
    };
    if (Number.isNaN(row.price) || Number.isNaN(row.cost)) return { error: `Preço ou custo inválido em "${vName}".` };
    if (Number.isNaN(row.minStock) || row.minStock < 0) return { error: `Estoque mínimo inválido em "${vName}".` };
    variants.push(row);
  }
  if (variants.length === 0) return { error: "Cadastre pelo menos um tamanho/opção." };
  const names = variants.map((v) => v.name.toLowerCase());
  if (new Set(names).size !== names.length) return { error: "Há tamanhos com o mesmo nome." };

  const saved = await prisma.$transaction(async (tx) => {
    const p = id
      ? await tx.product.update({ where: { id }, data: { ...product, ...photo } })
      : await tx.product.create({ data: { ...product, ...photo } });

    // Nomes temporários evitam conflito de unicidade ao renomear tamanhos entre si.
    const existing = variants.filter((v) => v.id);
    for (const v of existing) {
      await tx.variant.update({ where: { id: v.id, productId: p.id }, data: { name: `__tmp_${v.id}` } });
    }
    for (const [i, v] of variants.entries()) {
      const data = {
        name: v.name,
        servings: v.servings,
        price: v.price,
        cost: v.cost,
        minStock: v.minStock,
        active: v.active,
        sortOrder: i,
      };
      if (v.id) await tx.variant.update({ where: { id: v.id, productId: p.id }, data });
      else await tx.variant.create({ data: { ...data, productId: p.id } });
    }
    return p;
  });

  revalidatePath("/painel", "layout");
  if (!id) redirect(`/painel/estoque/${saved.id}?salvo=1`);
  return { ok: "Alterações salvas." };
}
