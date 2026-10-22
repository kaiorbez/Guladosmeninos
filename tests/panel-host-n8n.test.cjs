const {test}=require('node:test'),assert=require('node:assert/strict');
const {patchPanelHost,LEGACY_PANEL,VERCEL_PANEL}=require('../scripts/panel-host-n8n.cjs');
test('host migration preserves the workflow and changes only legacy panel endpoints',()=>{
 const w={active:false,nodes:[{name:'HTTP',parameters:{url:LEGACY_PANEL+'/api/agente/operacoes',other:['={{ "'+LEGACY_PANEL+'/api/agente/catalogo" }}','https://n8n.example/webhook']},credentials:{id:'keep'}}],connections:{keep:true}};
 const before=structuredClone(w);assert.equal(patchPanelHost(w).replacements,2);
 assert.equal(w.nodes[0].parameters.url,VERCEL_PANEL+'/api/agente/operacoes');
 assert.deepEqual(w.nodes[0].credentials,before.nodes[0].credentials);assert.deepEqual(w.connections,before.connections);assert.equal(w.active,false);
 assert.equal(w.nodes[0].parameters.other[1],'https://n8n.example/webhook');assert.equal(patchPanelHost(w).replacements,0);
 for(const base of ['http://example.com','https://user:secret@example.com','https://example.com/path'])assert.throws(()=>patchPanelHost(w,base));
});
