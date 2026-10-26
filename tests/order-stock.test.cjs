const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');

function load(){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/order-stock.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Math,Number,String,Array,Map,Set,JSON,require:()=>({})});
 return exports;
}
// Banco em memória com o mínimo que a baixa usa.
function db(order){
 const variants=[
  {id:'v-pote-brig',name:'Único',stock:10,product:{name:'Pote Brigadeiro'}},
  {id:'v-torta-p',name:'P',stock:1,product:{name:'Torta Beijinho com Chocolate'}},
  {id:'v-enc',name:'Sob consulta',stock:0,product:{name:'Encomenda'}},
 ];
 const moves=[];
 const byId=id=>variants.find(v=>v.id===id);
 const tx={
  order:{findUnique:async({where})=>where.id===order.id?order:null},
  variant:{
   findMany:async({where})=>variants.filter(v=>where.id?where.id.in.includes(v.id):v.product.name!==where.product.name.not).map(v=>({id:v.id,name:v.name,product:v.product})),
   findUnique:async({where})=>byId(where.id)?{stock:byId(where.id).stock}:null,
   findUniqueOrThrow:async({where})=>({stock:byId(where.id).stock}),
   updateMany:async({where,data})=>{const v=byId(where.id);if(!v||v.stock<where.stock.gte)return {count:0};v.stock+=data.stock.increment;return {count:1};},
   update:async({where,data})=>{byId(where.id).stock+=data.stock.increment;return byId(where.id);},
  },
  stockMovement:{
   findMany:async({where})=>moves.filter(m=>m.saleId===where.saleId),
   create:async({data})=>{moves.push(data);return data;},
  },
 };
 return {tx,variants,moves,byId};
}
const hoje=new Date('2026-10-26T18:00:00Z'); // 14h em La Paz
const order=(o={})=>({id:'o1',number:421,status:'PENDENTE',paid:0,deliveryDate:new Date('2026-10-26T00:00:00Z'),agentItems:[{variantId:'v-pote-brig',descricao:'Pote Brigadeiro',quantidade:2,precoUnitario:20}],...o});

test('sem pagamento não baixa; pagamento confirmado baixa 2 de 10',async()=>{
 const {syncOrderStock}=load();const o=order();const d=db(o);
 await syncOrderStock(d.tx,'o1',{now:hoje});assert.equal(d.byId('v-pote-brig').stock,10);
 o.paid=40;await syncOrderStock(d.tx,'o1',{now:hoje});assert.equal(d.byId('v-pote-brig').stock,8);
 assert.equal(d.moves.length,1);assert.equal(d.moves[0].type,'VENDA');assert.equal(d.moves[0].quantity,-2);assert.equal(d.moves[0].saleId,'encomenda:o1');
});
test('repetir a sincronização não baixa de novo; entrega também não duplica',async()=>{
 const {syncOrderStock}=load();const o=order({paid:40});const d=db(o);
 await syncOrderStock(d.tx,'o1',{now:hoje});await syncOrderStock(d.tx,'o1',{now:hoje});
 o.status='ENTREGUE';await syncOrderStock(d.tx,'o1',{now:hoje});
 assert.equal(d.byId('v-pote-brig').stock,8);assert.equal(d.moves.length,1);
});
test('cancelar ou excluir devolve ao estoque',async()=>{
 const {syncOrderStock}=load();const o=order({paid:40});const d=db(o);
 await syncOrderStock(d.tx,'o1',{now:hoje});o.status='CANCELADA';await syncOrderStock(d.tx,'o1',{now:hoje});
 assert.equal(d.byId('v-pote-brig').stock,10);assert.equal(d.moves[1].type,'ESTORNO');assert.equal(d.moves[1].quantity,2);
 const o2=order({paid:40});const d2=db(o2);await syncOrderStock(d2.tx,'o1',{now:hoje});await syncOrderStock(d2.tx,'o1',{release:true,now:hoje});
 assert.equal(d2.byId('v-pote-brig').stock,10);
});
test('pedido alterado depois de pago acerta só a diferença',async()=>{
 const {syncOrderStock}=load();const o=order({paid:40});const d=db(o);
 await syncOrderStock(d.tx,'o1',{now:hoje});o.agentItems=[{variantId:'v-pote-brig',descricao:'Pote Brigadeiro',quantidade:3,precoUnitario:20}];
 await syncOrderStock(d.tx,'o1',{now:hoje});assert.equal(d.byId('v-pote-brig').stock,7);
 o.agentItems=[{variantId:'v-pote-brig',descricao:'Pote Brigadeiro',quantidade:1,precoUnitario:20}];
 await syncOrderStock(d.tx,'o1',{now:hoje});assert.equal(d.byId('v-pote-brig').stock,9);
});
test('encomenda futura paga só baixa no dia (ou na entrega)',async()=>{
 const {syncOrderStock}=load();const o=order({paid:20,deliveryDate:new Date('2026-10-30T00:00:00Z')});const d=db(o);
 await syncOrderStock(d.tx,'o1',{now:hoje});assert.equal(d.byId('v-pote-brig').stock,10);
 await syncOrderStock(d.tx,'o1',{now:new Date('2026-10-30T15:00:00Z')});assert.equal(d.byId('v-pote-brig').stock,8);
 const o2=order({paid:20,deliveryDate:new Date('2026-10-30T00:00:00Z'),status:'ENTREGUE'});const d2=db(o2);
 await syncOrderStock(d2.tx,'o1',{now:hoje});assert.equal(d2.byId('v-pote-brig').stock,8);
});
test('falta de estoque não trava: baixa só o que há, nunca negativo',async()=>{
 const {syncOrderStock}=load();const o=order({paid:240,agentItems:[{variantId:'v-torta-p',descricao:'Torta Beijinho com Chocolate P',quantidade:2,precoUnitario:120}]});const d=db(o);
 await syncOrderStock(d.tx,'o1',{now:hoje});assert.equal(d.byId('v-torta-p').stock,0);assert.equal(d.moves[0].quantity,-1);
});
test('pedido antigo sem variantId usa o nome exato do cardápio; nome ambíguo ou livre não baixa',async()=>{
 const {syncOrderStock}=load();
 const o=order({paid:140,agentItems:[{descricao:'Torta Beijinho com Chocolate tamanho P',quantidade:1},{descricao:'pote brigadeiro',quantidade:1},{descricao:'Bolo personalizado tema Frozen',quantidade:1}]});const d=db(o);
 await syncOrderStock(d.tx,'o1',{now:hoje});
 assert.equal(d.byId('v-torta-p').stock,0);assert.equal(d.byId('v-pote-brig').stock,9);assert.equal(d.byId('v-enc').stock,0);assert.equal(d.moves.length,2);
});
