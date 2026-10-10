const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
const cfg=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i).trim(),x.slice(i+1).trim()]}));
async function api(p,m='GET',b){const r=await fetch(cfg.N8N_BASE_URL+'/api/v1/'+p,{method:m,headers:{'X-N8N-API-KEY':cfg.N8N_API_KEY,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw Error('n8n '+r.status);return r.json();}
(async()=>{
 const route='workflows/q2JCUkaCkX6Ab0Wg',w=await api(route);
 const snapshot=JSON.parse(fs.readFileSync(path.join(workspace,'n8n-backups-local/owner-oct9-live.json'),'utf8'));
 assert.deepEqual(w.nodes,snapshot.nodes,'Live nodes changed: review before publishing');
 assert.deepEqual(w.connections,snapshot.connections);
 const a=w.nodes.find(n=>n.name==='Agente Gula');assert(a);
 a.parameters.options.systemMessage=fs.readFileSync(path.join(root,'docs/PROMPT-AGENTE-COMPACTO.md'),'utf8').trim();
 const entry=w.nodes.find(n=>n.name==='Registrar Entrada Painel');assert(entry);
 const old="citacao:(q.text||{}).message||q.message||''";
 assert(entry.parameters.jsonBody.includes(old));
 entry.parameters.jsonBody=entry.parameters.jsonBody.replace(old,"citacao:typeof q==='string'?q:typeof q.text==='string'?q.text:(q.text||{}).message||(typeof q.message==='string'?q.message:'')||q.caption||(q.image||{}).caption||(q.document||{}).caption||''");
 const qr=w.nodes.find(n=>n.name==='enviar_qr_pagamento');assert(qr);
 qr.parameters.jsonBody=qr.parameters.jsonBody.replace("acao:'qr',","acao:'qr',quitarSaldo:$fromAI('quitarSaldo','true apenas quando cliente pedir expressamente quitar o saldo inteiro agora; false para cobrança normal','boolean',false),");
 qr.parameters.toolDescription+=' Se o cliente pedir expressamente pagar todo o restante agora, use quitarSaldo=true: o painel desconta o pago e permite quitação antecipada. Não cria novo pedido nem confirma recebimento.';
 await api(route,'PUT',{name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});
 await api(route+'/activate','POST',{});
 const live=await api(route);assert(live.active);assert.deepEqual(live.nodes,w.nodes);assert.deepEqual(live.connections,w.connections);
 console.log(JSON.stringify({active:live.active,promptAndQuoteExtractionPublished:true,modelAndConnectionsPreserved:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
