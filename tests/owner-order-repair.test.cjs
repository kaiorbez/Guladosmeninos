const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const target={id:'cmvchggki0004p83dsbq0sdf1',number:156,customerPhone:'558896002423',total:190,paid:0,status:'PENDENTE',saleId:null,deliveryDate:new Date('2026-10-20T00:00:00Z'),deliveryTime:'14:00',payments:[]};
 const payment={id:'payment-original',amount:95,saleId:'sale-original',paidAt:new Date('2026-10-17T15:26:29Z'),orderId:'cmvcjug2d0005p83dcmzdue6i'};
 const duplicate={...target,id:payment.orderId,number:157,customerPhone:'+55 88 9600-2423',paid:95,deliveryDate:new Date('2026-10-18T00:00:00Z'),payments:[payment]};
 const sale={id:'sale-original',status:'CONFIRMADA',total:95,customerPhone:duplicate.customerPhone};const events=[],activities=[];
 const tx={$executeRaw:async()=>{},agentEvent:{findUnique:async()=>events[0],create:async({data})=>events.push(data)},order:{findUnique:async({where})=>where.id===target.id?target:duplicate,update:async({where,data})=>Object.assign(where.id===target.id?target:duplicate,data)},orderPayment:{update:async({data})=>Object.assign(payment,data)},sale:{findUnique:async()=>sale,update:async({data})=>Object.assign(sale,data)}};
 const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/agent/owner-order-repair.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out,Date,JSON,Number,String,Error,require:()=>({recordOrderActivity:async(tx,id,action)=>activities.push({id,action})})});
 return {target,duplicate,payment,sale,events,activities,run:()=>out.repairCarmichelineDuplicate(tx)};
}
test('reviewed duplicate transfers original deposit without new payment, sale or refund',async()=>{
 const f=fixture();await f.run();await f.run();assert.equal(f.target.paid,95);assert.equal(f.duplicate.paid,0);assert.equal(f.duplicate.status,'CANCELADA');assert.equal(f.payment.orderId,f.target.id);assert.equal(f.payment.id,'payment-original');assert.equal(f.sale.total,95);assert.equal(f.payment.paidAt.toISOString(),'2026-10-17T15:26:29.000Z');assert.equal(f.events.length,1);assert.equal(f.activities.length,2);
});
test('unexpected state blocks reviewed correction before any write',async()=>{
 const f=fixture();f.target.paid=20;await assert.rejects(f.run(),/changed since review/);assert.equal(f.payment.orderId,f.duplicate.id);assert.equal(f.events.length,0);assert.equal(f.duplicate.status,'PENDENTE');
});
