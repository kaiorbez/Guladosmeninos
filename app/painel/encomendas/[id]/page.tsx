import { notFound } from "next/navigation";
import { OrderForm } from "@/components/OrderForm";
import { OrderPayments } from "@/components/OrderPayments";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { orderFormData } from "../suggestions";

export default async function EditarEncomenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, data] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { payments: { orderBy: { paidAt: "asc" } } } }),
    orderFormData(),
  ]);
  if (!order) notFound();

  return (
    <>
      <PageHeader title={`Encomenda #${order.number}`} subtitle={order.customerName} />
      <div className="space-y-4">
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
            channel: order.channel,
          }}
        />
        <OrderPayments
          orderId={order.id}
          missing={Number(order.total) - Number(order.paid)}
          payments={order.payments.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.method, paidAt: p.paidAt.toISOString() }))}
        />
      </div>
    </>
  );
}
