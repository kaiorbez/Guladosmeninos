const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map,Set,require:n=>mocks[n]||require(n)});return exports;}
const saleOrder=load('sale-order-key');
test('referências de sinal e restante identificam o mesmo pedido; referência órfã não colapsa vendas',()=>{
 const m=new Map([['p1','o1'],['p2','o1']]);
 assert.equal(saleOrder.saleOrderKey({id:'s1',externalRef:'encomenda-pagamento:p1'},m),'order:o1');
 assert.equal(saleOrder.saleOrderKey({id:'s2',externalRef:'encomenda-pagamento:p2'},m),'order:o1');
 assert.equal(saleOrder.saleOrderKey({id:'s3',externalRef:'encomenda:o1'},m),'order:o1');
 assert.equal(saleOrder.saleOrderKey({id:'s4',externalRef:'encomenda-pagamento:missing'},m),'sale:s4');
});
test('gráfico soma parcelas mas conta pedido uma vez por dia; ranking usa descrição real sem contar parcelas como unidades',async()=>{
 const sales=[{id:'s1',externalRef:'encomenda-pagamento:p1',total:65,createdAt:new Date('2026-10-08T14:00:00Z')},{id:'s2',externalRef:'encomenda-pagamento:p2',total:65,createdAt:new Date('2026-10-08T15:00:00Z')},{id:'s3',externalRef:null,total:20,createdAt:new Date('2026-10-08T16:00:00Z')}];
 const prisma={sale:{findMany:async()=>sales},orderPayment:{findMany:async()=>[{id:'p1',orderId:'o1'},{id:'p2',orderId:'o1'}]},saleItem:{findMany:async()=>sales.map(s=>({quantity:1,unitPrice:s.total,unitCost:0,sale:s,variant:{product:{id:s.externalRef?'internal':'empadao',name:s.externalRef?'Encomenda':'Empadão'}}}))},order:{findMany:async()=>[{id:'o1',product:'Bolo de chocolate P'}]}};
 const api=load('metrics',{'./db':{prisma,productImage:()=>null},'./sale-order-key':saleOrder,'./time':{startOfDay:n=>new Date(Date.parse('2026-10-08T04:00:00Z')-n*86400000),dayKey:d=>d.toISOString().slice(0,10)}});
 const days=await api.getDailySeries(2);assert.equal(days[1].revenue,150);assert.equal(days[1].orders,2);assert.equal(days[0].orders,0);
 const top=await api.getTopProducts(new Date('2026-10-01'));const cake=top.find(x=>x.name==='Bolo de chocolate P');assert.equal(cake.quantity,1);assert.equal(cake.revenue,130);assert.equal(cake.unit,'pedido(s)');assert.equal(top.some(x=>x.name==='Encomenda'),false);
});
