const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const state={orders:[{id:'cmvcotled0004my3cdrru27jt',number:160,customerPhone:'59178049800',total:230,paid:0,status:'PENDENTE',deliveryDate:new Date('2026-10-17T00:00:00Z')}],events:[],payments:[],sales:[],activities:[],ticketUpdates:[]};
 for(const [phone,id] of [['59178049800','4ABBCA974E293FFA243E'],['556596159186','AC170CD6A907A30A4F2AEF31A8C810DF']])state.events.push({key:`in:${phone}:${id}`,phone,payload:{media:'imagem',fromMe:false}});
 const tx={$executeRaw:async()=>{},agentEvent:{findUnique:async({where})=>state.events.find(e=>e.key===where.key),create:async({data})=>{state.events.push(data);return data;}},order:{findMany:async()=>state.orders,create:async({data})=>{const o={id:'ferreira',number:999,...data};state.orders.push(o);return o;}},sale:{findMany:async()=>state.sales},agentTicket:{updateMany:async x=>{state.ticketUpdates.push(x);return{count:1}}}};
 const exports={};const code=ts.transpileModule(fs.readFileSync('lib/agent/owner-receipt-repair.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,Date,Number,String,Error,require:name=>name==='./payments'?{recordReceiptPayment:async(tx,id,phone,media,amount,paidAt)=>{state.payments.push({id,phone,media,amount,paidAt});state.orders.find(o=>o.id===id).paid=amount;}}:{recordOrderActivity:async(tx,id,action)=>state.activities.push({id,action})}});
 return {state,run:()=>exports.repairOwnerReceiptsOctober17(tx)};
}
test('owner correction links original receipts without changing delivery status and is repeatable',async()=>{
 const f=fixture();await f.run();await f.run();assert.equal(f.state.orders.length,2);assert.equal(f.state.payments.length,2);
 assert.deepEqual(f.state.payments.map(p=>p.amount),[230,30]);assert.equal(f.state.orders[0].status,'PENDENTE');assert.equal(f.state.orders[1].status,'PENDENTE');
 assert.equal(f.state.payments[1].paidAt.toISOString(),'2026-10-17T14:48:00.000Z');assert.equal(f.state.ticketUpdates.length,1);
 assert.equal(f.state.ticketUpdates[0].where.phone,'59178049800');assert.equal(f.state.events.filter(e=>e.kind==='OWNER_RECEIPT_REPAIR').length,2);
});
test('manual order and previously recorded payment are reused',async()=>{
 const f=fixture();f.state.orders[0].paid=230;f.state.orders.push({id:'manual',number:200,customerPhone:'+55 65 9615-9186',total:30,paid:30,status:'ENTREGUE',deliveryDate:new Date('2026-10-17T00:00:00Z')});
 await f.run();assert.equal(f.state.payments.length,0);assert.equal(f.state.orders.length,2);assert.equal(f.state.orders[1].status,'ENTREGUE');
});
test('existing standalone sale blocks a duplicate Ferreira payment',async()=>{
 const f=fixture();f.state.orders[0].paid=230;f.state.sales.push({customerPhone:'+55 65 9615-9186',total:30});
 await assert.rejects(f.run(),/Existing sale/);assert.equal(f.state.orders.length,1);assert.equal(f.state.payments.length,0);
});
test('wrong or absent receipt sources cannot generate a payment',async()=>{
 const f=fixture();f.state.events=[];await f.run();assert.equal(f.state.payments.length,0);
 const g=fixture();g.state.events[0].payload.fromMe=true;await assert.rejects(g.run(),/source mismatch/);assert.equal(g.state.payments.length,0);
});
test('unexpected partial payment is preserved for review',async()=>{
 const f=fixture();f.state.orders[0].paid=100;await assert.rejects(f.run(),/partial payment/);assert.equal(f.state.orders[0].paid,100);assert.equal(f.state.payments.length,0);
});
