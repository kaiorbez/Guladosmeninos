const {test}=require('node:test'),assert=require('node:assert/strict');
const {claimsPositiveRegistration:claim}=require('../scripts/positive-registration.cjs');
test('negative and conditional registration statements are not false confirmations',()=>{
 for(const s of ['Todavía no puedo generar el QR porque el pedido aún no está registrado.','O pedido ainda não está registrado.','Não consegui registrar o pedido.','Depois de registrar o pedido envio o QR.','Preciso registrar o pedido.'])assert.equal(claim(s),false,s);
});
test('actual unsupported registration confirmations remain detected',()=>{
 for(const s of ['Seu pedido foi registrado.','Tu pedido está registrado.','Registrei seu pedido.','Registré tu pedido.','Não recebi pagamento. Seu pedido foi registrado.'])assert.equal(claim(s),true,s);
});
