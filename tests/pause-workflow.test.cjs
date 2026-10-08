const {test}=require('node:test'),assert=require('node:assert/strict');
const {patch}=require('../scripts/fix-human-pause-n8n.cjs');
function fixture(){return {nodes:[
 {name:'Bot Desativado?',parameters:{conditions:{conditions:[{}]}}},
 {name:'Buscar Status Agente',parameters:{}},{name:'Buscar Status (LID)',parameters:{}},
 {name:'Enviar Mensagem WhatsApp',parameters:{jsonBody:"texto:$json.mensagem,parte:$json.parte||'0'"}},
 {name:'Conferir Resposta e Resultados',parameters:{jsCode:"if (/^\\[?SEM_RESPOSTA\\]?$/.test(text)) text='';"}}
 ],connections:{'Loop Mensagens':{main:[[],[]]}}};}
function check(w,name,data){const expression=w.nodes.find(n=>n.name===name).parameters.conditions.conditions[0].leftValue.slice(3,-2);return Function('$','return '+expression)(name=>({first:()=>({json:data[name]||{}}),item:{json:data[name]||{}}}));}
test('Redis phone or LID pause blocks even when panel reports active',()=>{
 const w=patch(fixture());
 for(const data of [{'Buscar Status Agente':{status:'Desativado'}},{'Buscar Status (LID)':{statusLid:'Desativado'}},{'Registrar Entrada Painel':{pausado:true}}])assert.equal(check(w,'Bot Desativado?',data),true);
 assert.equal(check(w,'Bot Desativado?',{}),false);
});
test('patch remains idempotent and preserves loop completion',()=>{
 const w=patch(fixture());const expected=JSON.stringify(w);patch(w);assert.equal(JSON.stringify(w),expected);
 assert.equal(check(w,'Envio Pausado?',{'Rever Pausa Telefone':{status:'Desativado'}}),true);
 assert.equal(check(w,'Envio Pausado?',{'Rever Pausa LID':{statusLid:'Desativado'}}),true);
 assert.equal(check(w,'Envio Pausado?',{}),false);
 assert.equal(w.connections['Loop Mensagens'].main[1][0].node,'Rever Pausa Telefone');
 assert.equal(w.connections['Envio Pausado?'].main[0][0].node,'Fim Envio');
 assert.equal(w.connections['Envio Pausado?'].main[1][0].node,'Enviar Mensagem WhatsApp');
});

