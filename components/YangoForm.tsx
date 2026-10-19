'use client';
import { useActionState } from 'react';
import { sendYango } from '@/app/painel/encomendas/yango-actions';
export function YangoForm({orderId,ticketId,sentAt}:{orderId?:string;ticketId?:string;sentAt?:string|null}) {
 const [state,action,pending]=useActionState(sendYango,null);
 const at=state?.sentAt||sentAt;
 return <section className="mt-3 space-y-2 rounded-lg border border-creme-300 p-3">
  {at?<p className="text-sm font-medium text-emerald-700">Link enviado às {new Date(at).toLocaleTimeString('pt-BR',{timeZone:'America/La_Paz',hour:'2-digit',minute:'2-digit'})}</p>:<form action={action} className="space-y-2">
   <p className="text-sm font-semibold">Enviar link da Yango</p>
   <input type="hidden" name="orderId" value={orderId||''}/><input type="hidden" name="ticketId" value={ticketId||''}/>
   <label className="block text-sm">Link de acompanhamento<input name="link" type="url" required placeholder="https://delivery.yango.com/…" className="input mt-1 w-full"/></label>
   <label className="block text-sm">Valor da entrega (Bs) — opcional<input name="fee" type="number" min="0" max="10000" step="0.01" inputMode="decimal" className="input mt-1 w-full"/></label>
   <button disabled={pending} className="btn-primary disabled:opacity-50">{pending?'Enviando…':'Enviar ao cliente'}</button>
  </form>}
  {state&&<p role={state.ok?'status':'alert'} className={`text-sm ${state.ok?'text-emerald-700':'text-red-700'}`}>{state.message}</p>}
 </section>;
}
