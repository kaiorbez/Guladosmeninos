'use client';
import { useActionState } from 'react';
import { resolve } from './actions';
export function ResolutionForm({id,archived=false}:{id:string;archived?:boolean}) {
 const [state,action,pending]=useActionState(resolve,null);
 return <form action={action} className="space-y-2">
  <input type="hidden" name="id" value={id}/>
  {!archived&&<label className="block">Resposta dada ao cliente (opcional)<textarea className="input block w-full" name="resposta" maxLength={4000}/></label>}
  <button disabled={pending} className="btn-primary disabled:opacity-50">{pending?'Resolvendo…':archived?'Sincronizar liberação':'Marcar como resolvida'}</button>
  {state&&<p role={state.ok?'status':'alert'} className={state.ok?'text-emerald-700':'text-red-700'}>{state.message}</p>}
 </form>;
}
