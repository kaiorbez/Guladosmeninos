"use client";
import { useEffect, useState } from "react";

export function OrderActionNotice() {
  const [notice,setNotice]=useState<{ok:boolean;message:string}|null>(null);
  useEffect(()=>{
    const handler=(event:Event)=>setNotice((event as CustomEvent).detail);
    window.addEventListener('order-feedback',handler);
    return ()=>window.removeEventListener('order-feedback',handler);
  },[]);
  if(!notice)return null;
  return <div role={notice.ok?'status':'alert'} className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border bg-creme-50 p-4 text-sm shadow-lg ${notice.ok?'border-emerald-500 text-emerald-700 dark:text-emerald-400':'border-coral-500 text-coral-600'}`}>
    <span>{notice.message}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setNotice(null)}>✕</button>
  </div>;
}
