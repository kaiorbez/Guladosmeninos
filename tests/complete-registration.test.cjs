const {test}=require('node:test'),assert=require('node:assert/strict');const {shouldCompleteRegistration,patchCompletion}=require('../scripts/complete-registration.cjs');
test('retoma apenas aceite explícito sem ferramentas e promessa de QR sem pedido existente',()=>{
 const a={output:'Perfecto, tu pedido está confirmado. Te envío el QR.',intermediateSteps:[]};
 assert.equal(shouldCompleteRegistration(a,{message:'Si',pedidos:[]}),true);
 for(const c of [{message:'¿Cuál sería el total?'},{message:'Si',pedidos:[{situacao:'PENDENTE'}]},{message:'Não quero'}])assert.equal(shouldCompleteRegistration(a,c),false);
 assert.equal(shouldCompleteRegistration({...a,intermediateSteps:[{observation:'Nova mensagem'}]},{message:'Si'}),false);
 assert.equal(shouldCompleteRegistration({...a,output:'¿Confirmas el pedido? Te envío el QR después.'},{message:'Si'}),false);
});
test('tentativa complementar compartilha contexto/ferramentas, não cria ciclo e valida resultado final',()=>{
 const w={nodes:[{name:'Agente Gula',parameters:{text:'contexto do cliente',options:{systemMessage:'regras'}},position:[0,0]},{name:'Conferir Resposta e Resultados',parameters:{jsCode:"const a=$('Agente Gula').first().json;"}}],connections:{'Agente Gula':{main:[[{node:'Conferir Resposta e Resultados',type:'main',index:0}],[{node:'falha',type:'main',index:0}]]},model:{ai_languageModel:[[{node:'Agente Gula',type:'ai_languageModel',index:0}]]}}};
 patchCompletion(w);assert.equal(w.connections.model.ai_languageModel[0].length,2);assert.equal(w.connections['Concluir registro pendente'].main[0][0].node,'Conferir Resposta e Resultados');assert.equal(w.nodes.find(n=>n.name==='Conferir Resposta e Resultados').parameters.jsCode,'const a=$json;');assert.throws(()=>patchCompletion(w));
});
