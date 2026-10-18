const {test}=require('node:test'),assert=require('node:assert/strict');const {patchEntryRetries}=require('../scripts/agent-entry-retry.cjs');
test('entry retries are idempotent and preserve other nodes and connections',()=>{
 const w={nodes:[{name:'Registrar Entrada Painel',parameters:{jsonBody:"={{ JSON.stringify({acao:'entrada',telefone:'x'}) }}"}},{name:'Other',parameters:{anything:true}}],connections:{a:{main:[]}}};
 const connections=JSON.stringify(w.connections),other=JSON.stringify(w.nodes[1]);patchEntryRetries(w);const once=JSON.stringify(w);patchEntryRetries(w);assert.equal(JSON.stringify(w),once);assert.equal(w.nodes[0].maxTries,5);assert.equal(JSON.stringify(w.nodes[1]),other);assert.equal(JSON.stringify(w.connections),connections);assert.equal(w.nodes[0].parameters.jsonBody.split('recuperarPendente').length,2);
});
