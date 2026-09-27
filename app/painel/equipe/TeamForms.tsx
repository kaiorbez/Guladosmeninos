"use client";

import { useActionState } from "react";
import { addUserAction, changePasswordAction } from "./actions";

function Feedback({ state }: { state: { error?: string; ok?: string } | null }) {
  if (state?.error) return <p className="text-sm font-bold text-coral-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm font-bold text-dourado-600">✓ {state.ok}</p>;
  return null;
}

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, null);
  return (
    <form action={action} className="space-y-3">
      <input name="name" placeholder="Nome" required className="input" />
      <input name="email" type="email" placeholder="E-mail" required className="input" />
      <input name="password" type="password" placeholder="Senha (mín. 8 caracteres)" required minLength={8} className="input" />
      <button disabled={pending} className="btn-primary">Adicionar</button>
      <Feedback state={state} />
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="space-y-3">
      <input name="current" type="password" placeholder="Senha atual" required className="input" />
      <input name="next" type="password" placeholder="Nova senha" required minLength={8} className="input" />
      <button disabled={pending} className="btn-ghost">Trocar senha</button>
      <Feedback state={state} />
    </form>
  );
}
