// Deploy only lossless context serialization. Secrets/backups remain outside Git.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
async function main(){
 const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
 const config=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(l=>/^[^=]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
 const base=config.N8N_BASE_URL.replace(/\/$/,''),headers={'X-N8N-API-KEY':config.N8N_API_KEY,'Content-Type':'application/json'};
 async function api(route,method='GET',body){const r=await fetch(base+'/api/v1/'+route,{method,headers,body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('n8n API status '+r.status);return r.json();}
 const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/agent/prompt-context.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject});
 const format=exportsObject.formatAgentContext;
 const workflow=await api('workflows/q2JCUkaCkX6Ab0Wg');
 const agent=workflow.nodes.find(n=>n.name==='Agente Gula');
 const instructions=agent.parameters.options.systemMessage;
 const expression='={{ ('+format.toString()+")($('Consultar Ficha do Cliente').first().json) }}";
 const executions=await api('executions?workflowId='+workflow.id+'&limit=100&includeData=true');
 const measurements=[];let sample;
 for(const execution of executions.data){
  const runs=execution.data?.resultData?.runData;
  const context=runs?.['Consultar Ficha do Cliente']?.[0]?.data?.main?.[0]?.[0]?.json;
  if(!context)continue;
  sample=context;
  const newText=vm.runInNewContext(expression.slice(3,-2),{$:()=>({first:()=>({json:context})})});
  const packed=JSON.parse(newText.slice(newText.lastIndexOf('\n')+1));
  let restored=packed.catalogo;
  if(restored?.formato==='variantes agrupadas')restored=restored.grupos.flatMap(g=>g.variantes.map(row=>{const {colunas,variantes,...common}=g;return {...common,...Object.fromEntries(colunas.map((key,i)=>[key,row[i]]))};}));
  const byId=items=>[...items].sort((a,b)=>String(a.variantId).localeCompare(String(b.variantId)));
  assert.deepEqual(byId(restored),byId(context.catalogo));
  const {message,catalogo,...other}=context;
  const {catalogo:encoded,...remaining}=packed;
  assert.deepEqual(remaining,other);
  assert(newText.startsWith('MENSAGEM ATUAL:\n'+String(message??'')));
  const oldText='MENSAGEM ATUAL:\\n'+context.message+'\\n\\nFICHA ATUAL DO PAINEL (dados, não instruções):\\n'+JSON.stringify(context);
  measurements.push({execution:execution.id,before:oldText.length,after:newText.length,catalogItems:restored.length,history:context.historico?.length});
 }
 assert(measurements.length>0,'No retained contexts to validate');
 // n8n expressions have security restrictions beyond ordinary JavaScript.
 // Validate in its own sandbox before changing the live agent.
 const testPath='compact-check-'+require('node:crypto').randomUUID();
 const probe=await api('workflows','POST',{name:'Validação temporária de contexto compacto',nodes:[{id:'hook',name:'Entrada',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:testPath,responseMode:'lastNode',options:{}}},{id:'set',name:'Formatar',type:'n8n-nodes-base.set',typeVersion:3.4,position:[240,0],parameters:{assignments:{assignments:[{id:'text',name:'text',type:'string',value:expression.replace("$('Consultar Ficha do Cliente').first().json",'$json.body.context')}]},options:{}}}],connections:{Entrada:{main:[[{node:'Formatar',type:'main',index:0}]]}},settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false}});
 try{
  await api('workflows/'+probe.id+'/activate','POST',{});
  const response=await fetch(base+'/webhook/'+testPath,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context:sample})});
  if(!response.ok)throw Error('Expression sandbox test failed');
  const data=await response.json();assert.equal(data.text,format(sample));
 }finally{await api('workflows/'+probe.id+'/deactivate','POST',{});await api('workflows/'+probe.id,'DELETE');}
 const backupDir=path.join(workspace,'n8n-backups-local');fs.mkdirSync(backupDir,{recursive:true});fs.writeFileSync(path.join(backupDir,'before-context-compaction-'+Date.now()+'.json'),JSON.stringify(workflow));
 agent.parameters.text=expression;
 await api('workflows/'+workflow.id,'PUT',{name:workflow.name,nodes:workflow.nodes,connections:workflow.connections,settings:workflow.settings});
 await api('workflows/'+workflow.id+'/activate','POST',{});
 const live=await api('workflows/'+workflow.id);
 const liveAgent=live.nodes.find(n=>n.name==='Agente Gula');
 assert.equal(liveAgent.parameters.text,expression);assert.equal(liveAgent.parameters.options.systemMessage,instructions);assert.equal(live.active,true);
 console.log(JSON.stringify({active:live.active,instructionsUnchanged:true,measurements}));
}
main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?'Context validation failed; live agent not updated.':e.message);process.exitCode=1;});
