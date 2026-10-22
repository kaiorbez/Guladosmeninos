const assert=require('node:assert/strict');
const {VERCEL_PANEL}=require('./panel-host-n8n.cjs');
function buildPanelResumeWorkflow(main) {
const source=name=>{const n=main.nodes.find(n=>n.name===name);assert(n,name);return structuredClone(n)};
 const http=source('Registrar Entrada Painel');const auth=http.credentials.httpHeaderAuth;assert(auth);
 const webhook={id:'entry',name:'Entrada Painel',type:'n8n-nodes-base.webhook',typeVersion:2.1,position:[0,0],webhookId:'gula-panel-resume-auth',credentials:{httpHeaderAuth:auth},parameters:{httpMethod:'POST',path:'gula-resolver-painel',authentication:'headerAuth',responseMode:'lastNode',options:{}}};
 http.parameters.url=VERCEL_PANEL+'/api/agente/operacoes';http.id='check';http.name='Conferir Ficha';http.position=[220,0];http.parameters.jsonBody="={{ JSON.stringify({acao:'contexto',telefone:$('Entrada Painel').first().json.body.phone}) }}";
 const guard=source('Entrada Nova e Liberada?');guard.id='guard';guard.name='Liberação válida?';guard.position=[440,0];guard.parameters.conditions.conditions=[{id:'check',leftValue:"={{ $json.ok === true && $json.pausado === false && $json.geracao === $('Entrada Painel').first().json.body.generation && ($json.pendencias||[]).some(t=>t.id === $('Entrada Painel').first().json.body.ticketId && t.status === 'RESOLVIDA') }}",rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}];
 const lookup=source('Buscar LID para Retomada');lookup.id='lid';lookup.name='Buscar LID';lookup.position=[660,0];lookup.parameters.key="=gula_phone_lid_{{ $('Entrada Painel').first().json.body.phone }}";lookup.parameters.propertyName='lid';
 const clear=source('Liberar Pausa Resolvida');clear.id='clear';clear.name='Liberar Telefone';clear.position=[880,0];clear.parameters.key="={{ $('Entrada Painel').first().json.body.phone + '_gula_status' }}";
 const has=structuredClone(guard);has.id='has-lid';has.name='Possui LID?';has.position=[1100,0];has.parameters.conditions.conditions[0].leftValue="={{ !!$('Buscar LID').first().json.lid }}";
 const clearLid=source('Liberar Pausa LID Resolvida');clearLid.id='clear-lid';clearLid.name='Liberar LID';clearLid.position=[1320,0];clearLid.parameters.key="={{ $('Buscar LID').first().json.lid + '_gula_status' }}";
 const done={id:'done',name:'Concluído',type:'n8n-nodes-base.code',typeVersion:2,position:[1540,0],parameters:{jsCode:"return [{json:{ok:true,retomado:true,telefone:$('Entrada Painel').first().json.body.phone}}];"}};
 const denied={id:'denied',name:'Não liberado',type:'n8n-nodes-base.code',typeVersion:2,position:[660,220],parameters:{jsCode:"return [{json:{ok:false,retomado:false,motivo:'Atendimento mudou, está pausado ou a pendência não foi resolvida.'}}];"}};
 const edge=n=>[{node:n,type:'main',index:0}];const nodes=[webhook,http,guard,lookup,clear,has,clearLid,done,denied];const connections={'Entrada Painel':{main:[edge(http.name)]},[http.name]:{main:[edge(guard.name)]},[guard.name]:{main:[edge(lookup.name),edge(denied.name)]},[lookup.name]:{main:[edge(clear.name)]},[clear.name]:{main:[edge(has.name)]},[has.name]:{main:[edge(clearLid.name),edge(done.name)]},[clearLid.name]:{main:[edge(done.name)]}};

 return {name:'Gula — Liberação autenticada de pendências do painel',nodes,connections,settings:{executionOrder:'v1',saveDataSuccessExecution:'all',saveDataErrorExecution:'all'}};
}
module.exports={buildPanelResumeWorkflow};
