"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type TeamState = { error?: string; ok?: string } | null;

export async function addUserAction(_: TeamState, form: FormData): Promise<TeamState> {
  await requireSession();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || !email) return { error: "Preencha nome e e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Já existe alguém com esse e-mail." };

  await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/painel/equipe");
  return { ok: `${name} já pode entrar no painel.` };
}

export async function changePasswordAction(_: TeamState, form: FormData): Promise<TeamState> {
  const session = await requireSession();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) return { error: "Senha atual incorreta." };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: "Senha alterada." };
}
