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
