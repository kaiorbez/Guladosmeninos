const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/agent/prompt-context.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject});
const format=exportsObject.formatAgentContext;
const item=(id,size)=>({variantId:id,produto:'Bolo',tamanho:size,descricao:'Sabores e ingredientes completos, sem promessa de disponibilidade.',preco:130,estoque:0,controlaEstoque:true,precoSobConsulta:false});
function payload(text){return JSON.parse(text.slice(text.lastIndexOf('\n')+1));}
test('catálogo compacto conserva cada ID, preço, estoque e descrição, além de histórico e pedidos',()=>{
 const context={message:'Quero o mesmo pedido de ontem',historico:[{papel:'cliente',texto:'Minha localização: https://maps.google.com/?q=1,2',data:'2026-10-03'}],pedidos:[{id:'antigo',total:260,pagoConfirmado:130,saldo:130}],catalogo:[item('p','P'),item('g','G'),{...item('custom','GG'),precoSobConsulta:true,descricao:'Preço sob consulta'}],geracao:8};
 const result=payload(format(context));const restored=result.catalogo.grupos.flatMap(g=>g.variantes.map(row=>{const {colunas,variantes,...common}=g;return {...common,...Object.fromEntries(colunas.map((key,i)=>[key,row[i]]))};}));
 assert.deepEqual(restored,context.catalogo);assert.deepEqual(result.historico,context.historico);assert.deepEqual(result.pedidos,context.pedidos);assert.equal(result.geracao,8);assert.equal(result.message,undefined);assert(format(context).startsWith('MENSAGEM ATUAL:\n'+context.message));
});
test('novos campos de catálogo são preservados pelo formato original',()=>{
 const context={message:'Hola',catalogo:[{...item('p','P'),restricao:'contém leite'}]};
 assert.deepEqual(payload(format(context)).catalogo,context.catalogo);
 assert.deepEqual(payload(format({message:'Hola',catalogo:[]})).catalogo.grupos,[]);
});
test('repetição de descrições é reduzida sem truncar conversa ou catálogo',()=>{
 const context={message:'Hola',catalogo:Array.from({length:100},(_,i)=>item('v'+i,String(i))),historico:Array.from({length:100},(_,i)=>({papel:'cliente',texto:'Mensagem '+i,data:String(i)}))};
 assert(format(context).length<JSON.stringify(context).length*0.7);assert.equal(payload(format(context)).historico.length,100);assert.equal(payload(format(context)).catalogo.grupos[0].variantes.length,100);
});
