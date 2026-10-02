"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setProductPhotoAction } from "@/app/painel/estoque/actions";
import { resizeImage } from "@/lib/resize-image";
import { ProductPhoto } from "./ProductPhoto";

/** Miniatura clicável: escolhe uma foto e já salva no produto. */
export function PhotoUpload({ productId, src, name, size = 56 }: { productId: string; src: string | null; name: string; size?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <label className="group relative block shrink-0 cursor-pointer" title={src ? "Trocar foto" : "Enviar foto"}>
      <ProductPhoto src={src} name={name} size={size} />
      <span
        className={`absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 text-[11px] font-medium text-white transition ${
          pending ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {pending ? "Enviando…" : src ? "📷 Trocar" : "📷 Foto"}
      </span>
      {!src && !pending && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 text-[10px] text-white">📷</span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={pending}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const data = await resizeImage(file);
            start(async () => {
              const r = await setProductPhotoAction(productId, data);
              setError(r?.error ?? "");
              router.refresh();
            });
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && <span className="absolute left-0 top-full mt-1 w-40 text-[11px] text-coral-600">{error}</span>}
    </label>
  );
}
