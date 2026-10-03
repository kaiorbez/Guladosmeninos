"use server";

import type { ExpenseCategory, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CATEGORIES: ExpenseCategory[] = ["ALUGUEL", "FORNECEDOR", "FUNCIONARIO", "ENERGIA", "OUTROS"];
const METHODS: PaymentMethod[] = ["QR", "EFECTIVO", "TARJETA", "OTRO"];

export async function addExpenseAction(_: string | null, form: FormData): Promise<string | null> {
  const session = await requireSession();
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Informe a data.";
  const category = String(form.get("category")) as ExpenseCategory;
  if (!CATEGORIES.includes(category)) return "Escolha a categoria.";
  const amount = Number(String(form.get("amount") ?? "").trim().replace(",", "."));
  if (!(amount > 0)) return "Informe um valor maior que zero.";
  const method = String(form.get("method")) as PaymentMethod;

  await prisma.expense.create({
    data: {
      date: new Date(`${date}T00:00:00Z`),
      category,
      amount: Math.round(amount * 100) / 100,
      description: String(form.get("description") ?? "").trim().slice(0, 200) || null,
      method: METHODS.includes(method) ? method : null,
      userId: session.userId,
    },
  });
  revalidatePath("/painel/financeiro");
  return null;
}

export async function deleteExpenseAction(form: FormData) {
  await requireSession();
  await prisma.expense.deleteMany({ where: { id: String(form.get("id")) } });
  revalidatePath("/painel/financeiro");
}
