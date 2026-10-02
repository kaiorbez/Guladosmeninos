import { prisma } from "@/lib/db";
import { agentAuthorized, unauthorized } from "@/lib/agent-auth";
import { variantLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

// Catálogo para o agente do WhatsApp: cada tamanho/opção ativa com id, preço e estoque.
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return unauthorized();

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      category: { select: { name: true } },
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  const itens = products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      nome: variantLabel(p.name, v.name),
      produto: p.name,
      tamanho: v.name,
      categoria: p.category.name,
      descricao: p.description,
      preco: Number(v.price),
      estoque: v.stock,
      controlaEstoque: p.trackStock,
      precoSobConsulta: p.priceOnRequest,
      vendeNaLoja: p.onStore,
    })),
  );

  return Response.json({ ok: true, total: itens.length, itens });
}
