const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const exp={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/../lib/agent/quoted-prices.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp});
const items=[{produto:'Fatia Maracujá',preco:30,precoSobConsulta:false},{produto:'Fatia Prestígio',preco:30,precoSobConsulta:false},{produto:'Fatia Cenoura com Chocolate',preco:30,precoSobConsulta:false},{produto:'Pote Maracujá com Chocolate',preco:20,precoSobConsulta:false}];
const issues=t=>JSON.parse(JSON.stringify(exp.quotedPriceIssues(t,items)));
test('bloqueia maracujá por 35 em espanhol e mantém 30 pelo painel',()=>{
 assert.deepEqual(issues('1 porción de maracuyá con chocolate: 35 Bs'),[{produto:'Fatia Maracujá',precoCitado:35,precoAtual:30}]);
 assert.equal(issues('Entiendo, quieres agregar también la porción de maracuyá con chocolate (35 Bs).').length,1);
 assert.equal(issues('1 porción de maracuyá con chocolate: 30 Bs').length,0);
});
test('cabeçalho diferencia preços de fatias e potes e usa painel atualizado',()=>{
 assert.equal(issues('Porciones de torta:\n- Maracuyá con brigadeiro de chocolate: 35 Bs\n- Prestígio: 30 Bs').length,1);
 assert.equal(issues('Potes:\n- Maracuyá con chocolate: 20 Bs').length,0);
 assert.equal(exp.quotedPriceIssues('Fatia Maracujá: 35 Bs',[{...items[0],preco:35}]).length,0);
});
test('não confunde total, frete, promoção, múltiplas unidades ou tamanho ambíguo com preço avulso',()=>{
 for(const t of ['Total: 35 Bs','Envío: 35 Bs','2 porciones de maracuyá: 60 Bs','Promo 2 fatias Maracujá: 55 Bs','Pote e fatia no combo: 55 Bs'])assert.equal(issues(t).length,0,t);
 assert.equal(exp.quotedPriceIssues('Porção Maracujá: 35 Bs',[{...items[0],preco:30},{...items[0],preco:35}]).length,0);
});
test('bloqueia sabor ausente e estoque zero controlado sem bloquear produto sob encomenda',()=>{
 assert.equal(issues('Porción de Nido con frutos rojos: 30 Bs')[0].motivo,'FORA_CATALOGO');
 assert.equal(exp.quotedPriceIssues('Fatia Maracujá: 30 Bs',[{...items[0],controlaEstoque:true,estoque:0}])[0].motivo,'SEM_ESTOQUE');
 assert.equal(exp.quotedPriceIssues('Fatia Maracujá: 30 Bs',[{...items[0],controlaEstoque:false,estoque:0}]).length,0);
 assert.equal(issues('2 potes Maracuyá con chocolate: 40 Bs').length,0);
});
test('totais de linha com quantidade numérica ou por extenso não viram falso preço unitário',()=>{
 const p=[{produto:'Pote Ninho com Chocolate',preco:20,precoSobConsulta:false,controlaEstoque:true,estoque:5}];
 for(const text of ['2 bolos de pote Ninho com chocolate: 40 Bs','dois potes Ninho com chocolate: 40 Bs','dos potes Nido con chocolate: 40 Bs','Pote Ninho com Chocolate x 2: 40 Bs'])assert.equal(exp.quotedPriceIssues(text,p).length,0,text);
 assert.equal(exp.quotedPriceIssues('dois potes Ninho com chocolate: 50 Bs',p)[0].precoAtual,40);
});
test('não compara total de cesta mista ao preço dos potes',()=>{
 const p=[{produto:'Pote Ninho com Chocolate',preco:20,precoSobConsulta:false}];
 for(const s of ['Dois potes Ninho com brigadeiro de chocolate e seis docinhos, total 61 Bs','Dois potes Ninho com chocolate + três brigadeiros de paçoca + três de Ninho: 61 Bs','Seu pedido de dois potes Ninho com chocolate fica no total de 61 Bs','Dois potes Ninho com chocolate e docinhos: 50 Bs'])assert.equal(exp.quotedPriceIssues(s,p).length,0,s);
});
test('lista de sabores sem preço em cada linha exclui estoque zero sem bloquear encomenda autorizada',()=>{
 const catalog=[{produto:'Pote Ninho com Chocolate',preco:20,controlaEstoque:true,estoque:5},{produto:'Pote Ninho com Frutas Vermelhas',preco:25,controlaEstoque:true,estoque:0},{produto:'Pote Cenoura com Chocolate',preco:25,controlaEstoque:true,estoque:0}];
 const text='Temos bolos de pote clássicos por 20 Bs cada:\n- Ninho com chocolate\n\nE os premium por 25 Bs cada:\n- Ninho com frutas vermelhas\n- Cenoura com chocolate\n\nQual você gostaria?';
 const result=exp.filterAvailableProductLists(text,catalog);assert.match(result,/Ninho com chocolate/);assert.doesNotMatch(result,/frutas vermelhas|Cenoura|premium/);assert.match(result,/sem estoque/);
 assert.equal(exp.filterAvailableProductLists('Pedido antigo: Pote Ninho com Frutas Vermelhas pago 25 Bs',catalog),'Pedido antigo: Pote Ninho com Frutas Vermelhas pago 25 Bs');
 assert.match(exp.filterAvailableProductLists('Temos bolos de pote:\n- Ninho com frutas vermelhas',[{...catalog[1],controlaEstoque:false}]),/frutas vermelhas/);
});

const synonymCatalog=[
 {produto:'Pote Ninho com Frutas Vermelhas',preco:25,precoSobConsulta:false,controlaEstoque:true,estoque:5},
 {produto:'Pote Ninho com Morango',preco:25,precoSobConsulta:false},
 {produto:'Pote Cenoura com Chocolate',preco:25,precoSobConsulta:false},
 {produto:'Pote Maracujá com Chocolate',preco:20,precoSobConsulta:false},
 {produto:'Pote Doce de Leite com Chocolate',preco:20,precoSobConsulta:false},
 {produto:'Fatia Ninho com Frutas Vermelhas',preco:35,precoSobConsulta:false}
];
test('required cuchareable example matches the actual 25 Bs pot, preserving family and flavor',()=>{
 assert.equal(exp.quotedPriceIssues('un cuchareable de ninho con frutas rojas: 25 Bs',synonymCatalog).length,0);
 const wrong=exp.quotedPriceIssues('un cuchareable de ninho con frutas rojas: 20 Bs',synonymCatalog);
 assert.equal(wrong.length,1);assert.equal(wrong[0].produto,'Pote Ninho com Frutas Vermelhas');assert.equal(wrong[0].precoAtual,25);
});
test('all requested pot aliases match without case or accent differences',()=>{
 for(const alias of ['cuchareable','cuchareables','cucharable','postre de cuchara','bolo de pote','bolo no copo','torta en pote']) {
  for(const flavor of ['ninho con frutas rojas','NIDO CON FRUTOS ROJOS','NÍNHO COM FRÚTAS VERMÉLHAS']) {
   const text=`un ${alias} de ${flavor}: 25 Bs`;
   assert.equal(exp.quotedPriceIssues(text,synonymCatalog).length,0,text);
   const mismatch=exp.quotedPriceIssues(text.replace('25 Bs','24 Bs'),synonymCatalog);assert.equal(mismatch[0].precoAtual,25,text);
  }
 }
});
test('Spanish flavor and slice synonyms keep canonical price, stock and absent flavor checks',()=>{
 for(const text of ['Cucharable de Nido con frutilla: 25 Bs','Torta en pote Nido con fresa: 25 Bs','Bolo no copo de zanahoria con chocolate: 25 Bs','Postre de cuchara de maracuyá con chocolate: 20 Bs','Cuchareable de dulce de leche con chocolate: 20 Bs','Una porción de Nido con frutos rojos: 35 Bs'])assert.equal(exp.quotedPriceIssues(text,synonymCatalog).length,0,text);
 assert.equal(exp.quotedPriceIssues('Porción Nido con frutas rojas: 25 Bs',synonymCatalog)[0].precoAtual,35);
 assert.equal(exp.quotedPriceIssues('Cuchareable Nido con frutas rojas: 25 Bs',[{...synonymCatalog[0],estoque:0}])[0].motivo,'SEM_ESTOQUE');
 assert.equal(exp.quotedPriceIssues('Cuchareable Nido con frutas rojas: 25 Bs',[synonymCatalog[1]])[0].motivo,'FORA_CATALOGO');
 assert.equal(exp.quotedPriceIssues('dos postres de cuchara de Nido con frutos rojos: 50 Bs',synonymCatalog).length,0);
});

test('Spanish aliases in availability lists still filter sold-out flavors',()=>{
 const text='Tenemos cuchareables:\n- Nido con frutas rojas\n- Nido con fresa\n\n¿Cuál deseas?';
 const result=exp.filterAvailableProductLists(text,[{...synonymCatalog[0],estoque:0},{...synonymCatalog[1],controlaEstoque:true,estoque:2}]);
 assert(!result.includes('- Nido con frutas rojas'));assert(result.includes('- Nido con fresa'));
});

test('short flavor name matches the unique product in its family without a false missing-product alert',()=>{
 assert.deepEqual(issues('1 pote de Maracuyá: 20 Bs'),[]);
 assert.deepEqual(issues('1 pote de Maracuyá: 25 Bs'),[{produto:'Pote Maracujá com Chocolate',precoCitado:25,precoAtual:20}]);
 assert.equal(issues('2 potes de Maracuyá: 40 Bs').length,0);
 assert.equal(exp.quotedPriceIssues('1 pote de Maracuyá: 20 Bs',[items[0]])[0].motivo,'FORA_CATALOGO');
 assert.equal(exp.quotedPriceIssues('1 pote de Maracuyá: 20 Bs',[{...items[3],controlaEstoque:true,estoque:0}])[0].motivo,'SEM_ESTOQUE');
});

test('partial names never choose a flavor by price and ambiguous matches are not outside the catalog',()=>{
 const catalog=[items[3],{produto:'Pote Maracujá com Coco',preco:25,precoSobConsulta:false}];
 assert.equal(exp.quotedPriceIssues('1 pote de Maracuyá: 20 Bs',catalog).length,0);
 assert.equal(exp.quotedPriceIssues('1 pote de Maracuyá: 25 Bs',catalog).length,0);
 assert.equal(issues('1 pote de Maracuyá con fresa: 20 Bs')[0].motivo,'FORA_CATALOGO');
 assert.equal(issues('1 pote de baunilha: 20 Bs')[0].motivo,'FORA_CATALOGO');
 assert.equal(exp.quotedPriceIssues('1 pote de Maracuyá: 20 Bs',[{...items[3],precoSobConsulta:true}]).length,0);
});

test('mermelada normalizes to geleia for matching names and checking real prices',()=>{
 const catalog=[{produto:'Fatia Ninho com Geleia de Frutas Vermelhas',preco:35,precoSobConsulta:false}];
 assert.equal(exp.quotedPriceIssues('porción Nido con mermelada de frutos rojos: 35 Bs',catalog).length,0);
 assert.equal(exp.quotedPriceIssues('PORCIÓN NIDO CON MERMELADA DE FRUTOS ROJOS: 35 BS',catalog).length,0);
 assert.equal(exp.quotedPriceIssues('porción Nido con mermelada de frutos rojos: 30 Bs',catalog)[0].precoAtual,35);
 assert.equal(exp.quotedPriceIssues('porción Nido con frutos rojos: 35 Bs',catalog).length,0);
 assert.equal(exp.quotedPriceIssues('porción Nido con mermelada de frutos rojos: 35 Bs',synonymCatalog).length,0);
});
