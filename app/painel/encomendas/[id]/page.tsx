import { YangoForm } from '@/components/YangoForm';
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderForm } from "@/components/OrderForm";
import { OrderPayments } from "@/components/OrderPayments";
import { OrderProducedButton } from "@/components/OrderProducedButton";
import { dateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { decorationPhotoUrl } from "@/lib/orders";
import { orderFormData } from "../suggestions";

export default async function EditarEncomenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, data] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { payments: { orderBy: { paidAt: "asc" } }, activities: { orderBy: { createdAt: "desc" } } } }),
    orderFormData(),
  ]);
  if (!order) notFound();

  return (
    <>
      <PageHeader title={`Encomenda #${order.number}`} subtitle={order.customerName}>
        <Link href={`/painel/encomendas/nova?cliente=${order.id}`} className="btn-ghost">＋ Pedido p/ este cliente</Link>
      </PageHeader>
      <div className="space-y-4">
        {order.dispatchedAt&&<p className="font-semibold text-emerald-700">Saiu para entrega</p>}
        {(order.deliveryLinkSentAt||(order.status==='PENDENTE'&&order.deliveryMode==='ENTREGA'&&Number(order.paid)>0))&&<YangoForm orderId={order.id} sentAt={order.deliveryLinkSentAt?.toISOString()}/>}

        <section className="card">
          <h2>Histórico do pedido</h2>
          {order.activities.length ? <ul className="mt-2 space-y-2 text-sm">{order.activities.map(a=><li key={a.id}>{dateTime(a.createdAt)} · {a.action} · {a.actorName}</li>)}</ul> : <p className="mt-2 text-sm text-cacau-500">Sem alterações registradas. O histórico passa a registrar as ações a partir desta atualização.</p>}
        </section>
        {order.status === "PENDENTE" && <OrderProducedButton orderId={order.id} producedAt={order.producedAt} />}
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
            decorationPhotoUrl: decorationPhotoUrl(order),
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
