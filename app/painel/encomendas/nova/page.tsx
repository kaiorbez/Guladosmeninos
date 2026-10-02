import { OrderForm } from "@/components/OrderForm";
import { PageHeader } from "@/components/PageHeader";
import { orderFormData } from "../suggestions";

export default async function NovaEncomenda() {
  const data = await orderFormData();
  return (
    <>
      <PageHeader title="Nova encomenda" subtitle="A mesma ficha do bloco de papel" />
      <OrderForm
        {...data}
        values={{
          deliveryDate: data.today,
          deliveryTime: "",
          customerName: "",
          customerPhone: "",
          product: "",
          dough: "",
          filling: "",
          topping: "",
          decoration: "",
          total: "",
          paid: "",
          notes: "",
        }}
      />
    </>
  );
}
