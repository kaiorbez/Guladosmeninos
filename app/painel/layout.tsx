import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell, SIDEBAR_COOKIE } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <Suspense>
      <AppShell
        categories={categories.map((c) => ({ slug: c.slug, name: c.name, group: c.group ?? "Outros", count: c._count.products }))}
        logout={logout}
        defaultCollapsed={collapsed}
      >
        {children}
      </AppShell>
    </Suspense>
  );
}
