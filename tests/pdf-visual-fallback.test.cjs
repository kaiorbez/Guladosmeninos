const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {patchPdf,normalizePDF}=require('../scripts/pdf-visual-fallback.cjs');
function parse(j){return vm.runInNewContext("(function(){"+normalizePDF+"})()",{$json:j});}
function response(fields){return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(fields)}]}]};}
test('PDF textual não chama interpretação visual e conserva números originais',()=>{assert.equal(parse({text:'Pagamento Bs 200,00'})[0].json.text,'Pagamento Bs 200,00');});
test('PDF sem texto usa leitura visual e exige valor visível para comprovante',()=>{
 const r=parse(response({tipo:'COMPROVANTE_BANCARIO',valor:200,beneficiario:'Exemplo',data:null}));assert.match(r[0].json.text,/200/);assert.match(r[0].json.text,/COMPROVANTE_BANCARIO/);
 for(const j of [response({tipo:'ILEGIVEL'}),response({tipo:'COMPROVANTE_BANCARIO',valor:null}),{status:'incomplete',output:[]},{error:'timeout'},{output:[]}])assert.throws(()=>parse(j));
 assert.match(parse(response({tipo:'OUTRO_DOCUMENTO',descricao:'QR de cobrança'}))[0].json.text,/OUTRO_DOCUMENTO/);
});
test('fallback usa credencial existente, sem repetir extração vazia nem criar workflow',()=>{
 const w={nodes:[{name:'Analisar Imagem',credentials:{openAiApi:{id:'existing',name:'Existing'}}},{name:'Buffer Push PDF'},{name:'Registrar falha imagem',parameters:{jsonBody:"etapa:'imagem'"}},{name:'Baixar PDF'},{name:'Extrair Texto PDF'}],connections:{}};patchPdf(w);
 assert.equal(w.connections['Extrair Texto PDF'].main[0][0].node,'PDF precisa leitura visual?');assert.equal(w.connections['PDF precisa leitura visual?'].main[1][0].node,'Validar leitura PDF');assert.equal(w.nodes.find(n=>n.name==='Ler PDF visualmente').retryOnFail,false);assert.match(w.nodes.find(n=>n.name==='Ler PDF visualmente').parameters.jsonBody,/store:false/);assert.throws(()=>patchPdf(w));
});
