const {test}=require('node:test'),assert=require('node:assert/strict');
const {planCatalogMessages:plan,protectionLanguage:lang}=require('../scripts/catalog-sequence.cjs');
const steps=[{action:{tool:'enviar_cardapio'},observation:'[{"planejado":true,"enviado":false}]'}];
test('answer then document then contextual question',()=>{
 const p=plan([{json:{mensagem:'A torta custa 120 Bs. Para quantas pessoas você precisa? 😊'}}],steps);
 assert.equal(p.length,3);assert.equal(p[0].json.mensagem,'A torta custa 120 Bs.');assert.equal(p[1].json.catalogo,true);assert.match(p[2].json.mensagem,/Para quantas/);
});
test('Spanish question follows document, failed plans and silence do not send',()=>{
 assert.equal(plan([{json:{mensagem:'Cuesta 120 Bs. ¿Para cuántas personas? 😊'}}],steps)[2].json.mensagem,'¿Para cuántas personas? 😊');
 assert.equal(plan([],steps)[0].json.skip,true);
 assert.equal(plan([{json:{mensagem:'Olá'}}],[]).length,1);
 assert.equal(plan([{json:{mensagem:'Olá'}}],[{action:{tool:'enviar_cardapio'},observation:'{"ok":false}'}]).length,1);
});
test('protection uses customer language and ignores agent/internal language',()=>{
 assert.equal(lang([{papel:'cliente',texto:'Buenas tardes'},{papel:'atendente',texto:'Aguarde a equipe'}],'Okay'),'es');
 assert.equal(lang([],'Quanto custa?'),'pt');assert.equal(lang([],'¿Cuál es el precio?'),'es');
});
