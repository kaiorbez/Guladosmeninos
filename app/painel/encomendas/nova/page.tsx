import { OrderForm } from "@/components/OrderForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { orderFormData } from "../suggestions";

export default async function NovaEncomenda({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const data = await orderFormData();
  // ?cliente=<id de outra encomenda>: mais um pedido para o mesmo cliente, com os dados já preenchidos.
  const from = cliente ? await prisma.order.findUnique({ where: { id: cliente } }) : null;

  return (
    <>
      <PageHeader
        title="Nova encomenda"
        subtitle={from ? `Mais um pedido para ${from.customerName}` : "A mesma ficha do bloco de papel"}
      />
      <OrderForm
        {...data}
        values={{
          deliveryDate: from ? from.deliveryDate.toISOString().slice(0, 10) : data.today,
          deliveryTime: from?.deliveryTime ?? "",
          customerName: from?.customerName ?? "",
          customerPhone: from?.customerPhone ?? "",
          product: "",
          dough: "",
          filling: "",
          topping: "",
          decoration: "",
          total: "",
          paid: "",
          notes: "",
          channel: from?.channel ?? "WHATSAPP",
        }}
      />
    </>
  );
}
