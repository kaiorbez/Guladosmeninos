type Money = number | string | { toString(): string };
export type QueueOrder = {
  id: string;
  number: number;
  deliveryDate: Date;
  deliveryTime: string | null;
  createdAt: Date;
  paid: Money;
  payments: { amount: Money; paidAt: Date }[];
};

export function orderQueueGroup(time: string | null): "agora" | "agendados" | "sem-horario" {
  if (time?.trim().toUpperCase() === "AGORA") return "agora";
  if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time ?? "")) return "agendados";
  return "sem-horario";
}

function paymentTime(order: QueueOrder) {
  // Legacy paid orders can lack a payment row; retain their creation date as fallback.
  if (Number(order.paid) <= 0) return Number.POSITIVE_INFINITY;
  const dates = order.payments.filter(p => Number(p.amount) > 0).map(p => p.paidAt.getTime());
  return dates.length ? Math.min(...dates) : order.createdAt.getTime();
}

/** Sort the complete matching queue before pagination, so an immediate order cannot hide on a later page. */
export function compareOrderQueue(a: QueueOrder, b: QueueOrder) {
  const day = a.deliveryDate.getTime() - b.deliveryDate.getTime();
  if (day) return day;
  const rank = { agora: 0, agendados: 1, "sem-horario": 2 };
  const group = orderQueueGroup(a.deliveryTime);
  const groupDiff = rank[group] - rank[orderQueueGroup(b.deliveryTime)];
  if (groupDiff) return groupDiff;
  if (group === "agendados") {
    const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
    const timeDiff = minutes(a.deliveryTime!) - minutes(b.deliveryTime!);
    if (timeDiff) return timeDiff;
  }
  const paidA = paymentTime(a), paidB = paymentTime(b);
  if (paidA !== paidB) return paidA < paidB ? -1 : 1;
  return a.createdAt.getTime() - b.createdAt.getTime() || a.number - b.number || a.id.localeCompare(b.id);
}

export function groupOrderQueue<T extends { deliveryTime: string | null }>(orders: T[], pending: boolean) {
  if (!pending) return [{ key: "all", label: "", orders }];
  return ([
    { key: "agora", label: "Agora · ordem de pagamento" },
    { key: "agendados", label: "Agendados · ordem de horário" },
    { key: "sem-horario", label: "Horário a confirmar" },
  ] as const).map(group => ({ ...group, orders: orders.filter(o => orderQueueGroup(o.deliveryTime) === group.key) })).filter(group => group.orders.length);
}
