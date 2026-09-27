import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ProductForm } from "@/components/ProductForm";
import { prisma } from "@/lib/db";

export default async function NovoProdutoPage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader title="Novo produto" subtitle="Cadastre um item do cardápio">
        <Link href="/painel/estoque" className="btn-ghost">← Voltar</Link>
      </PageHeader>
      <ProductForm
        categories={categories}
        initial={{
          name: "",
          description: "",
          categoryId: "",
          trackStock: true,
          priceOnRequest: false,
          onStore: true,
          active: true,
          image: null,
          variants: [{ name: "Único", servings: "", price: "", cost: "", minStock: "0", active: true }],
        }}
      />
    </>
  );
}
