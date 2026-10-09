const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
const cfg=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i).trim(),x.slice(i+1).trim()]}));
async function api(p,m='GET',b){const r=await fetch(cfg.N8N_BASE_URL+'/api/v1/'+p,{method:m,headers:{'X-N8N-API-KEY':cfg.N8N_API_KEY,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw Error('n8n '+r.status);return r.json();}
(async()=>{
 const route='workflows/q2JCUkaCkX6Ab0Wg',w=await api(route);
 const a=w.nodes.find(n=>n.name==='Agente Gula');assert(a);
 const local=fs.readFileSync(path.join(root,'docs/PROMPT-AGENTE-COMPACTO.md'),'utf8').trim();
 const rules=local.split(/\r?\n/).filter(x=>x.startsWith('Combo Fatia (')||x.startsWith('PROMOÇÃO TEMPORÁRIA 09 a 11/10/2026')||x.startsWith('OFERTA PROATIVA DOS POTES 09 a 11/10/2026')||x.startsWith('COMPLEMENTO DO TRIO PROMOCIONAL:'));assert.equal(rules.length,4);
 const before=a.parameters.options.systemMessage;
 const missing=rules.filter(rule=>!before.includes(rule));
 if(!missing.length){console.log('Ofertas já publicadas.');return;}
 assert(before.includes('CATÁLOGO SOB CONSULTA'));
 fs.writeFileSync(path.join(workspace,'n8n-backups-local/before-combo-fatia-'+Date.now()+'.json'),JSON.stringify(w));
 a.parameters.options.systemMessage=before.replace('CATÁLOGO SOB CONSULTA','CATÁLOGO SOB CONSULTA\n'+missing.join('\n'));
 await api(route,'PUT',{name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});
 await api(route+'/activate','POST',{});
 const live=await api(route);assert(live.active);assert.deepEqual(live.nodes,w.nodes);assert.deepEqual(live.connections,w.connections);
 console.log(JSON.stringify({active:live.active,comboFatiaPublished:true,otherNodesPreserved:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
