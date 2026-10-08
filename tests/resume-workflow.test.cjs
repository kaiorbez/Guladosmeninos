const {test}=require('node:test');
const assert=require('node:assert/strict');
const {patch}=require('../scripts/audit-resume-patch.cjs');
function fixture(){
 const names=['Mapear LID do Cliente','Envio Confirmado?','Resolver LID (equipe)','Reset Status','Comando Reset?','Registrar Entrada Painel','Entrada Nova e Liberada?','Buscar Status Agente','Processar Resposta da Equipe','Reset Memoria','Reset Buffer'];
 const w={nodes:names.map(name=>({name,id:name,position:[0,0],parameters:{conditions:{conditions:[{leftValue:'={{ false }}'}]}}})),connections:{'Comando Reset?':{main:[[],[]]}}};
 w.nodes.find(n=>n.name==='Comando Reset?').parameters.conditions.conditions[0].leftValue="={{ ['#reset','#reiniciar'].includes($('Webhook').first().json.body.text.message) && $('Parametros Fluxo').first().json.NumerosTeste.split(',').includes($('Dados Lead').first().json.IdConversa) }}";
 return w;
}
function condition(w,name,data){const s=w.nodes.find(n=>n.name===name).parameters.conditions.conditions[0].leftValue;return Function('$','$json','return ('+s.slice(3,-2)+')')(n=>({first:()=>({json:data[n]})}),data.current||{});}
test('reset paused is allowlisted and ignores duplicate callbacks',()=>{
 const w=patch(fixture());const data={'Registrar Entrada Painel':{ok:true,ignorar:false,pausado:true},Webhook:{body:{text:{message:'#reset'}}},'Parametros Fluxo':{NumerosTeste:'59170000000'},'Dados Lead':{IdConversa:'59170000000'}};
 assert.equal(condition(w,'Comando Reset?',data),true);
 data['Registrar Entrada Painel'].ignorar=true;assert.equal(condition(w,'Comando Reset?',data),false);
 data['Registrar Entrada Painel'].ignorar=false;data['Dados Lead'].IdConversa='59179999999';assert.equal(condition(w,'Comando Reset?',data),false);
 assert.equal(w.connections['Comando Reset?'].main[1][0].node,'Entrada Nova e Liberada?');
 assert.equal(w.connections['Reset Atendimento Painel'].main[0][0].node,'Reset Memoria');
});
test('only confirmed resumption clears phone and LID pause',()=>{
 const w=patch(fixture());for(const current of [{ok:true,assumido:true},{ok:false,retomado:true,telefone:'59170000000'},{ok:true,retomado:false,telefone:'59170000000'}])assert.equal(condition(w,'Equipe Liberou Atendimento?',{current}),false);
 assert.equal(condition(w,'Equipe Liberou Atendimento?',{current:{ok:true,retomado:true,telefone:'59170000000'}}),true);
 assert.equal(w.connections['Buscar LID para Retomada'].main[0][0].node,'Liberar Pausa Resolvida');
 assert.equal(w.connections['Liberar Pausa Resolvida'].main[0][0].node,'Liberar Pausa LID Resolvida');
});
test('LID mapping is available while paused but never overwritten with empty LID',()=>{
 const w=patch(fixture());const data={Webhook:{body:{chatLid:'123@lid'}},'Registrar Entrada Painel':{ok:true,ignorar:false,pausado:true}};
 assert.equal(condition(w,'Cliente Possui LID?',data),true);data.Webhook.body.chatLid='';assert.equal(condition(w,'Cliente Possui LID?',data),false);
 assert.ok(w.connections['Registrar Entrada Painel'].main[0].some(e=>e.node==='Cliente Possui LID?'));
});
test('workflow patch is idempotent and all added connections target existing nodes',()=>{
 const w=patch(fixture()),before=JSON.stringify(w);patch(w);assert.equal(JSON.stringify(w),before);
 const names=new Set(w.nodes.map(n=>n.name));for(const c of Object.values(w.connections))for(const branch of c.main)for(const e of branch)assert.ok(names.has(e.node),e.node);
});
