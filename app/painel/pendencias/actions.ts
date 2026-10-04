'use server';
import { requireSession } from '@/lib/auth';
import { resolveTicket } from '@/lib/agent/service';
import { revalidatePath } from 'next/cache';
export async function resolve(form: FormData) {
  const session = await requireSession();
  await resolveTicket(String(form.get('id') || ''), String(form.get('resposta') || '').slice(0, 4000), String(session.userId));
  revalidatePath('/painel/pendencias');
}
