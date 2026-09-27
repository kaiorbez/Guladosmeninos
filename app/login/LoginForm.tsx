"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.email} key={state?.email} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {state?.error && <p className="text-sm font-bold text-coral-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
