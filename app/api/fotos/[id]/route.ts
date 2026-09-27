import { prisma } from "@/lib/db";

// Foto enviada pelo painel (guardada no banco). Pública para o agente do WhatsApp
// poder mandar a imagem ao cliente. A URL leva ?v=<data> para o cache ser seguro.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { photo: true, photoType: true },
  });
  if (!product?.photo) return new Response("Not found", { status: 404 });
  return new Response(product.photo, {
    headers: {
      "Content-Type": product.photoType ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
