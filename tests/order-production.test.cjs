const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(status='PENDENTE') {
 const order={id:'order-test',status,producedAt:null,agentVersion:1,paid:125,total:250,saleId:null};
 const prisma={order:{updateMany:async({where,data})=>{
   if(where.id!==order.id||where.status!==order.status||(where.producedAt===null?order.producedAt!==null:order.producedAt===null))return {count:0};
   order.producedAt=data.producedAt;order.agentVersion+=data.agentVersion.increment;return {count:1};
 }}};
 const activities=[];prisma.$transaction=async fn=>fn(prisma);
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/order-production.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require:n=>{if(n==='./order-history')return {recordOrderActivity:async(tx,id,action,userId)=>activities.push({id,action,userId})};assert.equal(n,'./db');return {prisma};}});
 return {order,activities,set:exports.setOrderProduced};
}
test('produzir preserva saldo e entrega, aceita desmarcar e não duplica marcação',async()=>{
 const f=fixture();assert.equal((await f.set('order-test',true,'matheus')).count,1);
 assert.equal(f.activities[0].userId,'matheus');
 const stamp=f.order.producedAt;assert.ok(stamp instanceof Date);
 assert.equal(f.order.status,'PENDENTE');assert.equal(f.order.paid,125);assert.equal(f.order.total,250);assert.equal(f.order.saleId,null);
 assert.equal((await f.set('order-test',true)).count,0);assert.equal(f.activities.length,1);assert.equal(f.order.producedAt,stamp);assert.equal(f.order.agentVersion,2);
 assert.equal((await f.set('order-test',false)).count,1);assert.equal(f.order.producedAt,null);assert.equal(f.order.paid,125);
});
test('não altera produção de pedido entregue, cancelado ou inexistente',async()=>{
 for(const status of ['ENTREGUE','CANCELADA']){const f=fixture(status);assert.equal((await f.set('order-test',true)).count,0);assert.equal(f.order.producedAt,null);}
 const f=fixture();assert.equal((await f.set('other',true)).count,0);
});
