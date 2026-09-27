import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/painel");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#3A2519_0%,_#1A100B_65%)] px-4">
      <div className="card w-full max-w-sm border-transparent p-8 shadow-2xl shadow-black/60">
        <Image src="/logo.png" alt="Gula dos Meninos" width={160} height={160} className="mx-auto mix-blend-multiply" priority />
        <h1 className="mt-2 text-center text-2xl">Painel Gula dos Meninos</h1>
        <p className="mb-6 text-center text-sm text-cacau-500">Estoque, vendas e indicadores</p>
        <LoginForm />
      </div>
    </main>
  );
}
