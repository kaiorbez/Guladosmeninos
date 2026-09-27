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
    <div className={`card ${tone === "accent" ? "border-cacau-900 bg-cacau-900 text-creme-50" : ""}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone === "accent" ? "text-dourado-400" : "text-cacau-500"}`}>
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-semibold">{value}</p>
      {hint && <p className={`mt-1 text-xs ${tone === "accent" ? "text-creme-300" : "text-cacau-400"}`}>{hint}</p>}
    </div>
  );
}
