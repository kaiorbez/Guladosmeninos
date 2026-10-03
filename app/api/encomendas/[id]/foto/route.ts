import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Foto de referência da decoração de uma encomenda (só para quem está logado no painel).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Não autorizado", { status: 401 });
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { decorationPhoto: true, decorationPhotoType: true },
  });
  if (!order?.decorationPhoto) return new Response("Not found", { status: 404 });
  return new Response(order.decorationPhoto, {
    headers: {
      "Content-Type": order.decorationPhotoType ?? "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
