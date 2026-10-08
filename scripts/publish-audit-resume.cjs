const fs=require('node:fs'),path=require('node:path');
const {patch}=require('./audit-resume-patch.cjs');
const workspace=path.resolve(__dirname,'../..');
const cfg=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return[s.slice(0,i).trim(),s.slice(i+1).trim()]}));
async function api(p,method='GET',body){const r=await fetch(cfg.N8N_BASE_URL+'/api/v1/'+p,{method,headers:{'X-N8N-API-KEY':cfg.N8N_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('n8n '+r.status);return r.json();}
(async()=>{
 const route='workflows/q2JCUkaCkX6Ab0Wg',w=await api(route);
 fs.writeFileSync(path.join(workspace,'n8n-backups-local/before-resume-audit-'+Date.now()+'.json'),JSON.stringify(w));
 patch(w);const names=new Set(w.nodes.map(n=>n.name));
 for(const [from,types]of Object.entries(w.connections)){if(!names.has(from))throw Error('Missing source '+from);for(const branches of Object.values(types))for(const edges of branches)for(const e of edges)if(!names.has(e.node))throw Error('Missing target '+e.node);}
 for(const n of w.nodes){if(n.parameters.jsCode)new Function('$','$input',n.parameters.jsCode);}
 await api(route,'PUT',{name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});await api(route+'/activate','POST',{});
 const live=await api(route);
 if(!live.active||JSON.stringify(live.connections)!==JSON.stringify(w.connections))throw Error('Readback connections');
 for(const n of w.nodes)if(JSON.stringify(n.parameters)!==JSON.stringify(live.nodes.find(x=>x.name===n.name)?.parameters))throw Error('Readback '+n.name);
 console.log(JSON.stringify({active:true,readback:true,nodes:live.nodes.length,model:live.nodes.find(n=>n.name==='OpenAI Chat Model').parameters.model.value,modelCalls:0,customerMessages:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
