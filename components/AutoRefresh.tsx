"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Só nas telas de consulta: em formulários, atualizar no meio de um "Salvar" trava a navegação.
const PAGES = ["/painel", "/painel/encomendas", "/painel/encomendas/cozinha", "/painel/vendas", "/painel/clientes"];

/** Atualiza os dados da tela de tempos em tempos (aba visível e ninguém digitando). */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const enabled = PAGES.includes(pathname);

  useEffect(() => {
    if (!enabled) return;
    let lastInteraction = Date.now();
    const interacted = () => { lastInteraction = Date.now(); };
    const events = ['scroll','wheel','pointerdown','keydown','submit'] as const;
    for (const name of events) window.addEventListener(name, interacted, {passive:true,capture:true});
    const id = setInterval(() => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (document.visibilityState === "visible" && !typing && Date.now()-lastInteraction > 15000) router.refresh();
    }, seconds * 1000);
    return () => { clearInterval(id); for(const name of events)window.removeEventListener(name,interacted,true); };
  }, [router, seconds, enabled]);

  return null;
}
