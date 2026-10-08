const fs=require('node:fs'),path=require('node:path');
const {claimsPositiveRegistration}=require('./positive-registration.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
const cfg=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
async function api(p,m='GET',b){const r=await fetch(cfg.N8N_BASE_URL+'/api/v1/'+p,{method:m,headers:{'X-N8N-API-KEY':cfg.N8N_API_KEY,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw Error('n8n '+r.status);return r.json();}
(async()=>{
 const route='workflows/q2JCUkaCkX6Ab0Wg',w=await api(route),node=name=>w.nodes.find(n=>n.name===name);
 fs.writeFileSync(path.join(workspace,'n8n-backups-local/before-sales-fix-'+Date.now()+'.json'),JSON.stringify(w));
 const guard=node('Conferir Resposta e Resultados');
 const line=guard.parameters.jsCode.split('\n').find(s=>s.startsWith('const claimsRegistered='));if(!line)throw Error('Missing registration guard');
 guard.parameters.jsCode=guard.parameters.jsCode.replace(line,'const claimsRegistered=('+claimsPositiveRegistration.toString()+')(text);');
 node('Agente Gula').parameters.options.systemMessage=fs.readFileSync(path.join(root,'docs/PROMPT-AGENTE-COMPACTO.md'),'utf8').trim();
 const tool=node('avisar_equipe');
 const policy='VENDA COMUM: não abrir DUVIDA apenas porque o pedido é para agora, falta dado normal do cliente ou há pendência antiga criada pela IA sobre disponibilidade. Produtos padrão com preço definido e estoque suficiente, dentro do horário, seguem registro e QR. Use DUVIDA imediatamente para exceção real não resolvida por catálogo/regras/contexto; preserve comprovantes e pausa humana.';
 if(!tool.parameters.toolDescription.includes(policy))tool.parameters.toolDescription+='\n'+policy;
 // Syntax-check the live code locally; no model or customer call.
 new Function('$',guard.parameters.jsCode);
 await api(route,'PUT',{name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});await api(route+'/activate','POST',{});
 const live=await api(route);for(const name of ['Agente Gula','avisar_equipe','Conferir Resposta e Resultados'])if(JSON.stringify(node(name).parameters)!==JSON.stringify(live.nodes.find(n=>n.name===name).parameters))throw Error('Readback '+name);
 if(!live.active||JSON.stringify(live.connections)!==JSON.stringify(w.connections))throw Error('Connections mismatch');
 console.log(JSON.stringify({active:true,model:live.nodes.find(n=>n.name==='OpenAI Chat Model').parameters.model.value,normalSalesPolicy:true,negativeRegistrationGuardFixed:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
