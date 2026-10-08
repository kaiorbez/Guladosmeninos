"use client";
import { useState, useTransition } from "react";
import { performOrderAction } from "@/app/painel/encomendas/actions";

export function OrderActionForm({ operation, className, children }: { operation: string; className?: string; children: React.ReactNode }) {
  const [pending,startTransition] = useTransition();
  const [result,setResult] = useState<{ok:boolean;message:string}|null>(null);
  return <form className={className} onSubmit={e=>{
    e.preventDefault(); if(pending)return;
    const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const form=new FormData(e.currentTarget);
    form.set('operation',submitter?.value || operation);
    setResult(null);
    startTransition(async()=>{
      let response;
      try{response=await performOrderAction(form);}catch{response={ok:false,message:'Falha de conexão. Atualize a página e confira o pedido antes de repetir.'};}
      setResult(response);window.dispatchEvent(new CustomEvent('order-feedback',{detail:response}));
    });
  }}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    {pending && <span role="status" className="text-xs text-cacau-500">Salvando…</span>}
    {result && <span role={result.ok?'status':'alert'} className={`block basis-full text-xs ${result.ok?'text-emerald-700 dark:text-emerald-400':'text-coral-600'}`}>{result.message}</span>}
  </form>;
}
