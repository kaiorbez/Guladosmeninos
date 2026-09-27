import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

// A foto enviada pelo painel fica no banco; nunca carregar junto nas listagens.
function createClient() {
  return new PrismaClient({ omit: { product: { photo: true } } });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** URL da foto do produto: a enviada pelo painel tem prioridade sobre a do cardápio. */
export function productImage(p: { id: string; imageUrl: string | null; photoUpdatedAt: Date | null }) {
  if (p.photoUpdatedAt) return `/api/fotos/${p.id}?v=${p.photoUpdatedAt.getTime()}`;
  return p.imageUrl;
}
