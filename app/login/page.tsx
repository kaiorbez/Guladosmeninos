import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/painel");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <Image src="/logo.png" alt="Gula dos Meninos" width={160} height={160} className="mx-auto mix-blend-multiply" priority />
        <h1 className="mt-2 text-center text-2xl">Painel dos sócios</h1>
        <p className="mb-6 text-center text-sm text-cacau-500">Estoque, vendas e indicadores</p>
        <LoginForm />
      </div>
    </main>
  );
}
