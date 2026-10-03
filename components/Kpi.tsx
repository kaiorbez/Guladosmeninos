import Link from "next/link";

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent";
  /** Com link, o card inteiro abre o detalhe (ex.: vendas do período). */
  href?: string;
}) {
  const className = `card block ${tone === "accent" ? "border-dourado-500/60 bg-dourado-400/10" : ""} ${
    href ? "group transition hover:border-dourado-500 hover:shadow-md" : ""
  }`;
  const body = (
    <>
      <p className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-cacau-500">
        {label}
        {href && <span className="normal-case tracking-normal text-dourado-600 opacity-70 group-hover:opacity-100">Ver detalhes →</span>}
      </p>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-cacau-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
