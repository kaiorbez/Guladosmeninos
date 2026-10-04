const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {expression}=require('../scripts/team-takeover-n8n.cjs');
function accepts(body) { return vm.runInNewContext(expression.slice(3,-2),{$:name=>({item:{json:name==='Webhook'?{body}:{WhatsAppEquipe:'group'}}})}); }
test('grupo encaminha resposta livre citada inclusive do próprio atendente, mas ignora eco e mensagens soltas',()=>{
 const b={isGroup:true,phone:'group',messageId:'m',referenceMessageId:'notice',text:{message:'Deixa comigo, vou verificar'}};
 assert.equal(accepts(b),true);assert.equal(accepts({...b,fromMe:true}),true);
 assert.equal(accepts({...b,fromApi:true}),false);
 assert.equal(accepts({...b,isGroup:false}),false);assert.equal(accepts({...b,phone:'other'}),false);
 assert.equal(accepts({...b,referenceMessageId:undefined}),false);
 assert.equal(accepts({...b,referenceMessageId:undefined,quotedMessage:{messageId:'notice'}}),true);
 assert.equal(accepts({...b,text:{message:'Resolvido'}}),true);
 assert.equal(accepts({...b,text:{message:'https://delivery.yango.com/route/#abc'}}),true);
});
