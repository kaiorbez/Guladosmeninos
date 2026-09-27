import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/painel");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgb(var(--creme-200))_0%,_rgb(var(--creme-100))_60%)] px-4">
      <div className="tema-claro card w-full max-w-sm p-8 shadow-2xl shadow-black/50">
        <Image src="/logo.png" alt="Gula dos Meninos" width={160} height={160} className="mx-auto mix-blend-multiply" priority />
        <h1 className="mt-2 text-center text-2xl">Painel Gula dos Meninos</h1>
        <p className="mb-6 text-center text-sm text-cacau-500">Estoque, vendas e indicadores</p>
        <LoginForm />
      </div>
    </main>
  );
}
