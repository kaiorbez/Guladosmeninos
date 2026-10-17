const {test}=require('node:test');
const assert=require('node:assert/strict');
const {guardResponse}=require('../scripts/agent-response-guard.cjs');
test('removes redundant reply to okay while team confirmation is pending',()=>{
 assert.equal(guardResponse('Combinado, te aviso','Okay','Já pedi à equipe para verificar e te responder.',false),'');
});
test('preserves acceptance, new information and completed tool actions',()=>{
 for(const [input,previous,actions] of [['Okay','A equipe pode confirmar. Quer encomendar?',false],['Okay','Pode confirmar o pedido?',false],['Okay','Aguarda equipe',true],['Okay, quero 20','Aguarda equipe',false]])
 assert.equal(guardResponse('Resposta',input,previous,actions),'Resposta');
});
test('repairs observed Russian greeting without changing normal messages',()=>{
 assert.equal(guardResponse('Oii! 😊 Чем posso te ajudar?','oi','',false),'Oii! 😊 Como posso te ajudar?');
 assert.equal(guardResponse('Como posso te ajudar?','oi','',false),'Como posso te ajudar?');
});

test('delivery acknowledgment does not reopen confirmed preparation',()=>{
 assert.equal(guardResponse('Tu pedido ya está en preparación','Bueno espero el delivery','Tu pedido se encuentra en preparación.',false),'');
 assert.equal(guardResponse('Te aviso quando sair','Vou aguardar a entrega','O pedido está em preparação.',false),'');
 for(const [input,previous,actions] of [['Espero el delivery a las 18','Pedido en preparación.',false],['Bueno espero el delivery','¿Quieres entrega?',false],['Vou aguardar a entrega','Pedido em preparação.',true],['Espero el delivery, quanto demora?','Pedido em preparação.',false]])
 assert.equal(guardResponse('Resposta',input,previous,actions),'Resposta');
});
