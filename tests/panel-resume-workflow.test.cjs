const {test}=require('node:test'),assert=require('node:assert/strict');const {buildPanelResumeWorkflow}=require('../scripts/panel-resume-workflow.cjs');
test('panel resume bridge authenticates requests and uses only nodes inside its workflow',()=>{
 const names=['Registrar Entrada Painel','Entrada Nova e Liberada?','Buscar LID para Retomada','Liberar Pausa Resolvida','Liberar Pausa LID Resolvida'];
 const w=buildPanelResumeWorkflow({nodes:names.map(name=>({name,type:'test',credentials:{httpHeaderAuth:{id:'test',name:'Agent auth'}},parameters:{...(name==='Registrar Entrada Painel'?{url:"={{ $('Parametros Fluxo').first().json.url }}"}:{}),conditions:{conditions:[{}]}}}))});
 const entries=new Set(w.nodes.map(n=>n.name));assert.equal(w.nodes[0].parameters.authentication,'headerAuth');assert.equal(w.nodes[1].parameters.url,'https://guladosmeninos-production.up.railway.app/api/agente/operacoes');
 for(const node of w.nodes)for(const match of JSON.stringify(node.parameters).matchAll(/\$\('([^']+)'\)/g))assert(entries.has(match[1]),match[1]);
 const check=w.nodes.find(n=>n.name==='Liberação válida?').parameters.conditions.conditions[0].leftValue;assert(check.includes('geracao'));assert(check.includes('pausado === false'));assert(check.includes("status === 'RESOLVIDA'"));
});
