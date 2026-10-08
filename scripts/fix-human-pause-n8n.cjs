const fs=require('node:fs'),path=require('node:path');
const {guardResponse}=require('./agent-response-guard.cjs');
function patch(w){
 const node=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('Missing node '+name);return n;};
 node('Bot Desativado?').parameters.conditions.conditions[0].leftValue="={{ $('Registrar Entrada Painel').first().json.pausado === true || $('Buscar Status Agente').first().json.status === 'Desativado' || $('Buscar Status (LID)').first().json.statusLid === 'Desativado' }}";
 const specs=[['Rever Pausa Telefone','Buscar Status Agente'],['Rever Pausa LID','Buscar Status (LID)']];
 for(const [name,source] of specs){if(!w.nodes.some(n=>n.name===name)){const n=structuredClone(node(source));n.name=name;n.id=name.replaceAll(' ','-');n.position=[3000,1200+specs.findIndex(v=>v[0]===name)*150];w.nodes.push(n);}}
 if(!w.nodes.some(n=>n.name==='Envio Pausado?')){
  const n=structuredClone(node('Bot Desativado?'));n.id='guard-pause-before-send';n.name='Envio Pausado?';n.position=[3300,1200];w.nodes.push(n);
 }
 node('Envio Pausado?').parameters.conditions.conditions[0].leftValue="={{ $('Rever Pausa Telefone').item.json.status === 'Desativado' || $('Rever Pausa LID').item.json.statusLid === 'Desativado' }}";
 const edge=name=>[{node:name,type:'main',index:0}];
 w.connections['Loop Mensagens'].main[1]=edge('Rever Pausa Telefone');
 w.connections['Rever Pausa Telefone']={main:[edge('Rever Pausa LID')]};
 w.connections['Rever Pausa LID']={main:[edge('Envio Pausado?')]};
 w.connections['Envio Pausado?']={main:[edge('Fim Envio'),edge('Enviar Mensagem WhatsApp')]};
 const sender=node('Enviar Mensagem WhatsApp');
 sender.parameters.jsonBody=sender.parameters.jsonBody.replace('texto:$json.mensagem',"texto:$('Loop Mensagens').item.json.mensagem").replace("parte:$json.parte||'0'","parte:$('Loop Mensagens').item.json.parte||'0'");
 const guard=node('Conferir Resposta e Resultados');
 if(!guard.parameters.jsCode.includes('// AUDIT_RESPONSE_GUARD')){
  const anchor="if (/^\\[?SEM_RESPOSTA\\]?$/.test(text)) text='';";
  if(!guard.parameters.jsCode.includes(anchor))throw Error('Guard anchor missing');
  const addition="// AUDIT_RESPONSE_GUARD\nconst prior=(current.historico||[]).filter(m=>m.papel==='atendente').at(-1)?.texto||'';\ntext=("+guardResponse.toString()+")(text,current.message,prior,steps.length>0);\n";
  guard.parameters.jsCode=guard.parameters.jsCode.replace(anchor,addition+anchor);
 }
 return w;
}
async function publish(){
 const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
 const cfg=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
 async function api(p,m='GET',b){const r=await fetch(cfg.N8N_BASE_URL+'/api/v1/'+p,{method:m,headers:{'X-N8N-API-KEY':cfg.N8N_API_KEY,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw Error('n8n '+r.status);return r.json();}
 const route='workflows/q2JCUkaCkX6Ab0Wg';const w=await api(route);
 fs.writeFileSync(path.join(workspace,'n8n-backups-local/before-pause-audit-'+Date.now()+'.json'),JSON.stringify(w));
 patch(w);await api(route,'PUT',{name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});await api(route+'/activate','POST',{});
 const live=await api(route);for(const name of ['Bot Desativado?','Envio Pausado?','Conferir Resposta e Resultados','Enviar Mensagem WhatsApp'])if(JSON.stringify(live.nodes.find(n=>n.name===name).parameters)!==JSON.stringify(w.nodes.find(n=>n.name===name).parameters))throw Error('Readback mismatch '+name);
 if(!live.active||JSON.stringify(live.connections)!==JSON.stringify(w.connections))throw Error('Activation verification failed');console.log(JSON.stringify({active:live.active,pauseBeforeProcessing:true,pauseBeforeSending:true,responseGuard:true}));
}
module.exports={patch};
if(require.main===module)publish().catch(e=>{console.error(e.message);process.exitCode=1});
