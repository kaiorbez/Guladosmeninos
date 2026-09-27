import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { AddUserForm, ChangePasswordForm } from "./TeamForms";

export default async function EquipePage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { sales: true } } },
  });
  return (
    <>
      <PageHeader title="Equipe" subtitle="Quem tem acesso ao painel" />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <table className="table-base">
            <thead><tr><th>Nome</th><th>E-mail</th><th className="text-right">Vendas registradas</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold">{u.name}</td>
                  <td className="text-cacau-500">{u.email}</td>
                  <td className="text-right">{u._count.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 text-xl">Adicionar pessoa</h2>
            <AddUserForm />
          </section>
          <section className="card">
            <h2 className="mb-3 text-xl">Minha senha</h2>
            <ChangePasswordForm />
          </section>
        </div>
      </div>
    </>
  );
}
