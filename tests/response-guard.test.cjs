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

test('empty scanned PDF always requests a readable image in customer language',()=>{
 const input='<ContextoPDF><TranscricaoPDF> \n </TranscricaoPDF></ContextoPDF>';
 assert.match(guardResponse('[SEM_RESPOSTA]',input,'Pago: 65 Bs. Envíanos el comprobante para revisión.',false),/Recibí el PDF.*foto o captura/);
 assert.match(guardResponse('Enviei o QR',input,'Pagamento: 65 Bs',true),/Recebi o PDF.*foto ou captura/);
 assert.equal(guardResponse('Documento recebido','<TranscricaoPDF>Valor 65</TranscricaoPDF>','',false),'Documento recebido');
});

test('planning prefaces and exact repeated paragraphs never reach customer',()=>{
 assert.equal(guardResponse('Pronto para o resumo. Vou fazer uma oferta, que é a morango.\n\nAqui está o resumo:\nTorta: 230 Bs','Quero o resumo','',false),'Aqui está o resumo:\nTorta: 230 Bs');
 assert.equal(guardResponse('Total: 82 Bs.\n\nTotal: 82 Bs.\n\nEntrega ou retirada?','Quero esses','',false),'Total: 82 Bs.\n\nEntrega ou retirada?');
 assert.equal(guardResponse('1 Sprite: 6 Bs.\n\n2 Sprites: 12 Bs.','Quantos?','',false),'1 Sprite: 6 Bs.\n\n2 Sprites: 12 Bs.');
});
