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

test('modelo de acetato continua padrão e encontrável mesmo em consulta de personalizados',()=>{
 const model=item('Torta em Acetato Modelo 11','m11',150,{controlaEstoque:false});
 const custom=item('Torta temática','custom',0,{precoSobConsulta:true});
 const all=[model,custom,item('Torta Brigadeiro','b',120)];
 assert.deepEqual(restore(select(all,'personalizados')),[model,custom]);
 assert.deepEqual(restore(select(all,'bolos,personalizados')),all);
 const found=restore(select(all,'personalizados'))[0];
 assert.equal(found.precoSobConsulta,false);assert.equal(found.preco,150);assert.equal(found.variantId,'m11');
});

test('busca por nome devolve só os produtos citados, sem acento e no plural',()=>{
 const maracuja=item('Torta Maracujá com Brigadeiro de Chocolate','mar',130);const ninho=item('Torta Ninho com Chocolate','nin',120);
 const modelo=item('Torta em Acetato Modelo 11','m11',150);const outro=item('Torta em Acetato Modelo 1','m1',135);const kit=item('Kit Mini Cumpleaños','kmc',100);
 const all=[maracuja,ninho,modelo,outro,kit,item('Pote Ninho','p')];
 let r=select(all,'bolos','maracuya chocolate');assert.deepEqual(restore(r).map(x=>x.variantId),['mar']);
 r=select(all,'bolos','maracujá');assert.deepEqual(restore(r).map(x=>x.variantId),['mar']);assert.equal(r.escopo,'busca');assert.equal(r.totalCatalogo,6);
 r=select(all,'bolos','modelo 11');assert.deepEqual(restore(r).map(x=>x.variantId),['m11']);
 r=select(all,'kits','kit cumpleaños');assert.deepEqual(restore(r).map(x=>x.variantId),['kmc']);
 r=select(all,'bolos','tortas de ninho');assert.deepEqual(restore(r).map(x=>x.variantId),['nin']);
 r=select(all,'bolos','torta de nido');assert.deepEqual(restore(r).map(x=>x.variantId),['nin']);
});

test('busca sem resultado volta para a família pedida e sem busca nada muda',()=>{
 const all=[item('Torta Brigadeiro','b',120),item('Pote Ninho','p')];
 const r=select(all,'bolos','abacaxi');assert.equal(r.buscaSemResultado,true);assert.deepEqual(restore(r).map(x=>x.variantId),['b']);
 assert.deepEqual(select(all,'bolos'),select(all,'bolos',''));
});

test('regra de disponibilidade permanente vai uma vez só e cada torta aponta para ela',()=>{
 const rule='DISPONIBILIDADE PERMANENTE AUTORIZADA: massa de chocolate P, M e G; massa branca só P. Não estender a GG.';
 const a=item('Torta Ninho','n',120,{descricao:'Recheio de Ninho.\n'+rule});const b=item('Torta Prestígio','p',130,{descricao:'Coco e chocolate.\n'+rule});const c=item('Torta Comum','c',100);
 const r=select([a,b,c],'bolos');const json=JSON.stringify(r);
 assert.equal(json.split('DISPONIBILIDADE PERMANENTE AUTORIZADA:').length-1,1);
 assert.deepEqual(r.regrasDisponibilidade,{R1:rule});
 const out=restore(r);
 assert.equal(out[0].descricao,'Recheio de Ninho. [Disponibilidade permanente autorizada: ver regrasDisponibilidade.R1]');
 assert.equal(out[2].descricao,'Ingredientes completos');assert.deepEqual(out.map(x=>x.variantId),['n','p','c']);
 assert.equal(select([c],'bolos').regrasDisponibilidade,undefined);
 const found=select([a,b,c],'bolos','prestigio');assert.deepEqual(restore(found).map(x=>x.variantId),['p']);assert.deepEqual(found.regrasDisponibilidade,{R1:rule});
});
