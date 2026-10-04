const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const expression = "={{ (() => { const b = $('Webhook').item.json.body; const t = String((b.text || {}).message || '').trim(); const ref = b.referenceMessageId || (b.quoted || {}).messageId || (b.quotedMessage || {}).messageId; return b.isGroup === true && b.fromApi !== true && String(b.phone) === String($('Parametros Fluxo').item.json.WhatsAppEquipe) && (/^\\s*yango\\b/i.test(t) || (!!ref && !!t)); })() }}";
module.exports = { expression };
async function main() {
 const workspace = path.resolve(__dirname, '../..');
 const config = Object.fromEntries(fs.readFileSync(path.join(workspace, 'n8n-vps.local.env'), 'utf8').split(/\r?\n/).filter(l => /^[^=]+=/.test(l)).map(l => { const i=l.indexOf('='); return [l.slice(0,i).trim(),l.slice(i+1).trim()]; }));
 const base=config.N8N_BASE_URL.replace(/\/$/, '');
 async function api(route, method='GET', body) {
  const response=await fetch(base+'/api/v1/'+route,{method,headers:{'X-N8N-API-KEY':config.N8N_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!response.ok) throw Error('n8n API status '+response.status);
  return response.json();
 }
 const workflow=await api('workflows/q2JCUkaCkX6Ab0Wg');
 const gate=workflow.nodes.find(n=>n.name==='Comando Yango no Grupo?');
 const team=workflow.nodes.find(n=>n.name==='Processar Resposta da Equipe');
 assert(gate && team,'Expected team response nodes');
 const backup=path.join(workspace,'n8n-backups-local');fs.mkdirSync(backup,{recursive:true});
 fs.writeFileSync(path.join(backup,'before-team-takeover-'+Date.now()+'.json'),JSON.stringify(workflow));
 gate.parameters.conditions.conditions[0].leftValue=expression;
 const body=team.parameters.jsonBody;
 assert(body.includes("acao:'equipe',"),'Unexpected team payload');
 if(!body.includes('fromApi:'))team.parameters.jsonBody=body.replace("acao:'equipe',","acao:'equipe',fromApi:$('Webhook').first().json.body.fromApi===true,");
 await api('workflows/'+workflow.id,'PUT',{name:workflow.name,nodes:workflow.nodes,connections:workflow.connections,settings:workflow.settings});
 await api('workflows/'+workflow.id+'/activate','POST',{});
 const saved=await api('workflows/'+workflow.id);
 assert(saved.active);
 assert.equal(saved.nodes.find(n=>n.name===gate.name).parameters.conditions.conditions[0].leftValue,expression);
 console.log('Team response routing published; no WhatsApp messages sent.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
