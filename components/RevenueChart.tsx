import { bs, shortDate } from "@/lib/format";

type Point = { day: string; revenue: number; orders: number };

/** Barras de faturamento diário em SVG puro (sem dependências). */
export function RevenueChart({ data }: { data: Point[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const W = 700;
  const H = 200;
  const gap = 8;
  const bw = (W - gap * (data.length - 1)) / data.length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="h-auto w-full" role="img" aria-label="Faturamento por dia">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} className="stroke-creme-300" strokeDasharray="3 4" />
        ))}
        {data.map((d, i) => {
          const h = (d.revenue / max) * (H - 12);
          const x = i * (bw + gap);
          const isToday = i === data.length - 1;
          return (
            <g key={d.day}>
              <title>{`${shortDate(new Date(d.day + "T12:00:00Z"))}: ${bs(d.revenue)} · ${d.orders} pedido(s)`}</title>
              <rect
                x={x}
                y={H - Math.max(h, d.revenue > 0 ? 3 : 1)}
                width={bw}
                height={Math.max(h, d.revenue > 0 ? 3 : 1)}
                rx={4}
                className={isToday ? "fill-coral-500" : "fill-dourado-400"}
              />
              <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="fill-cacau-400 text-[11px]">
                {d.day.slice(8, 10)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-right text-xs text-cacau-400">Maior dia: {bs(max === 1 ? 0 : max)}</p>
    </div>
  );
}
