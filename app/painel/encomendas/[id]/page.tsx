import { notFound } from "next/navigation";
import { OrderForm } from "@/components/OrderForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { orderFormData } from "../suggestions";

export default async function EditarEncomenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, data] = await Promise.all([prisma.order.findUnique({ where: { id } }), orderFormData()]);
  if (!order) notFound();

  return (
    <>
      <PageHeader title={`Encomenda #${order.number}`} subtitle={order.customerName} />
      <OrderForm
        {...data}
        values={{
          id: order.id,
          deliveryDate: order.deliveryDate.toISOString().slice(0, 10),
          deliveryTime: order.deliveryTime ?? "",
          customerName: order.customerName,
          customerPhone: order.customerPhone ?? "",
          product: order.product,
          dough: order.dough ?? "",
          filling: order.filling ?? "",
          topping: order.topping ?? "",
          decoration: order.decoration ?? "",
          total: String(Number(order.total)),
          paid: String(Number(order.paid)),
          notes: order.notes ?? "",
        }}
      />
    </>
  );
}
