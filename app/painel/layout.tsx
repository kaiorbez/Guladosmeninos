import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLowStock } from "@/lib/metrics";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const [categories, lowStock] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: { active: true } } } } },
    }),
    getLowStock(),
  ]);

  return (
    <div className="lg:flex">
      <Suspense>
        <Sidebar
          categories={categories.map((c) => ({ slug: c.slug, name: c.name, group: c.group ?? "Outros", count: c._count.products }))}
          alerts={lowStock.length}
          logout={logout}
        />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
