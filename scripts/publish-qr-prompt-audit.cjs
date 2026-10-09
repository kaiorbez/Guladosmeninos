const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
const cfg=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i).trim(),x.slice(i+1).trim()]}));
async function api(p,m='GET',b){const r=await fetch(cfg.N8N_BASE_URL+'/api/v1/'+p,{method:m,headers:{'X-N8N-API-KEY':cfg.N8N_API_KEY,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw Error('n8n '+r.status);return r.json();}
(async()=>{
 const route='workflows/q2JCUkaCkX6Ab0Wg',w=await api(route);
 const a=w.nodes.find(n=>n.name==='Agente Gula');assert(a);
 const local=fs.readFileSync(path.join(root,'docs/PROMPT-AGENTE-COMPACTO.md'),'utf8').trim();
 const before=a.parameters.options.systemMessage;
 const old=fs.readFileSync(path.join(workspace,'n8n-backups-local/prompt-before-qr-audit.txt'),'utf8').trim();
 const canonical=s=>s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).sort();
 assert.deepEqual(canonical(before),canonical(old),'Live prompt changed; stop rather than overwrite');
 fs.writeFileSync(path.join(workspace,'n8n-backups-local/before-qr-prompt-audit-'+Date.now()+'.json'),JSON.stringify(w));
 a.parameters.options.systemMessage=local;
 await api(route,'PUT',{name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});
 await api(route+'/activate','POST',{});
 const live=await api(route);assert(live.active);assert.deepEqual(live.nodes,w.nodes);assert.deepEqual(live.connections,w.connections);
 console.log(JSON.stringify({active:live.active,comboFatiaPublished:true,otherNodesPreserved:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
