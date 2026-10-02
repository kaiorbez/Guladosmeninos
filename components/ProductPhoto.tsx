/* eslint-disable @next/next/no-img-element */

/** Foto quadrada do produto, com um marcador bonito quando ainda não tem foto. */
export function ProductPhoto({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    return <img src={src} alt={name} width={size} height={size} loading="lazy" className="thumb" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="thumb flex items-center justify-center font-semibold text-dourado-600"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {name.replace(/^(Torta|Pote|Fatia|Combo|Vela)\s+/i, "").charAt(0)}
    </span>
  );
}
