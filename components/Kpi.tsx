export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent";
}) {
  return (
    <div className={`card ${tone === "accent" ? "border-dourado-500/60 bg-dourado-400/10" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-cacau-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-cacau-500">{hint}</p>}
    </div>
  );
}
