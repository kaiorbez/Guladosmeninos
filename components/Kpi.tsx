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
  const accent = tone === "accent";
  return (
    <div
      className={`card ${accent ? "border-transparent bg-gradient-to-br from-dourado-400 to-dourado-500 text-[#1E140E]" : ""}`}
    >
      <p className={`text-xs font-bold uppercase tracking-wide ${accent ? "text-[#1E140E]/75" : "text-cacau-500"}`}>{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className={`mt-1 text-xs font-bold ${accent ? "text-[#1E140E]/75" : "text-cacau-400"}`}>{hint}</p>}
    </div>
  );
}
