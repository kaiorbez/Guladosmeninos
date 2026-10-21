const {test}=require('node:test');
const assert=require('node:assert/strict');
const {quotedText,patch}=require('../scripts/quoted-location-n8n.cjs');
test('quoted location preserves coordinates and caption, including zero and strings',()=>{
 assert.equal(quotedText({location:{latitude:'-17.7',longitude:'-63.1',address:'Torre 503'}}),'[Localização citada: https://maps.google.com/?q=-17.7,-63.1 Torre 503]');
 assert.equal(quotedText({text:{message:'Aqui'},location:{latitude:0,longitude:0}}),'Aqui\n[Localização citada: https://maps.google.com/?q=0,0]');
 assert.match(quotedText({message:{location:{latitude:-17,longitude:-63}}}),/q=-17,-63/);
});
test('invalid quoted coordinates do not invent a location or lose the original quote',()=>{
 for(const location of [{latitude:null,longitude:0},{latitude:'',longitude:0},{latitude:91,longitude:0},{latitude:1,longitude:181},{latitude:'NaN',longitude:0}])assert.equal(quotedText({caption:'Texto',location}),'Texto');
 for(const q of ['Oferta',{text:'Oferta'},{text:{message:'Oferta'}},{message:'Oferta'},{image:{caption:'Oferta'}},{document:{caption:'Oferta'}}])assert.equal(quotedText(q),'Oferta');
 assert.equal(quotedText(null),'');
});
test('n8n patch modifies only quote extraction, is idempotent, and evaluates coordinates',()=>{
 const expression="={{ JSON.stringify((()=>{const b=$('Webhook').first().json.body;const q=b.quoted||b.quotedMessage||{};return {acao:'entrada',citacao:q.caption||'',anuncio:null};})()) }}";
 const w={active:false,nodes:[{name:'Registrar Entrada Painel',parameters:{jsonBody:expression,url:'unchanged'}},{name:'Other',parameters:{unchanged:true}}],connections:{unchanged:true}};
 patch(w);const once=JSON.stringify(w);patch(w);assert.equal(JSON.stringify(w),once);assert.equal(w.active,false);assert.equal(w.nodes[1].parameters.unchanged,true);assert.equal(w.nodes[0].parameters.url,'unchanged');
 const run=Function('$','return '+w.nodes[0].parameters.jsonBody.slice(3,-2));
 const result=JSON.parse(run(()=>({first:()=>({json:{body:{quotedMessage:{caption:'Entregar aqui',location:{latitude:-17,longitude:-63}}}}})})));
 assert.equal(result.acao,'entrada');assert.match(result.citacao,/Entregar aqui\n.*q=-17,-63/);
});
