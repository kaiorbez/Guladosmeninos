const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const path=require('node:path');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/agent/catalog-context.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject});const select=(...args)=>JSON.parse(JSON.stringify(exportsObject.catalogForPrompt(...args)));
const item=(produto,id,price=20,extra={})=>({produto,variantId:id,tamanho:'P',descricao:'Ingredientes completos',preco:price,estoque:0,controlaEstoque:true,precoSobConsulta:false,...extra});
const restore=r=>r.itens||r.grupos.flatMap(g=>g.variantes.map(row=>{const {variantes,...common}=g;return {...common,...Object.fromEntries(r.colunas.map((k,i)=>[k,row[i]]))};}));
test('consulta de potes e fatias conserva sabores, preço, SKU e estoque sem misturar combos',()=>{
 const chosen=[item('Pote Ninho','p'),item('Fatia Maracujá','f',30)];const all=[...chosen,item('Combo Bolo de Pote','kit',55),item('Coca-Cola','bebida',7)];
 const r=select(all,'potes,fatias');assert.deepEqual(restore(r),chosen);assert.equal(r.totalCatalogo,4);assert.equal(r.totalRetornado,2);assert.equal(r.grupos[0].controlaEstoque,true);assert.equal(r.grupos[0].variantes[0][3],0);
});
test('catálogo completo e categoria desconhecida não perdem nenhuma variante, incluindo consulta de preço e campos novos',()=>{
 const all=[item('Torta chocolate','b'),item('Temática','c',0,{precoSobConsulta:true}),item('Chantilly','a')];assert.deepEqual(restore(select(all,'todos')),all);assert.deepEqual(restore(select(all,'categoria futura')),all);assert.deepEqual(restore(select(all,'personalizados')),[all[1]]);
 const extended=[item('Torta chocolate','b',20,{alergenos:'leite'})];assert.deepEqual(restore(select(extended,'bolos')),extended);
});


test('torta sob orçamento aparece na consulta de personalizados e não perde SKU',()=>{
 const custom=item('Torta temática','personalizado',0,{precoSobConsulta:true});const ordinary=item('Torta chocolate','padrao',130);
 assert.deepEqual(restore(select([custom,ordinary],'personalizados')),[custom]);
 assert.deepEqual(restore(select([custom,ordinary],'bolos')),[ordinary]);
});
