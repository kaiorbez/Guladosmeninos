const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const state={order:{id:'cmvcqjbrf000kpk3cj5uu5y8c',number:164,customerPhone:'59175076087',status:'ENTREGUE',total:100,paid:100,notes:'Entrega hoje\nCONCILIAÇÃO PENDENTE: cliente solicitou reembolso de 20 Bs'},source:{phone:'59175076087',payload:{fromMe:true,media:'imagem'}},events:[],expenses:[],activities:[]};
 const tx={$executeRaw:async()=>{},agentEvent:{findUnique:async({where})=>where.key.startsWith('in:')?state.source:state.events[0],create:async({data})=>state.events.push(data)},order:{findUnique:async()=>state.order,update:async({data})=>Object.assign(state.order,data)},expense:{findMany:async()=>state.expenses,create:async({data})=>{state.expenses.push(data);return data;}}};
 const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/agent/owner-refund-repair.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out,Date,Number,Error,require:()=>({recordOrderActivity:async(tx,id,action)=>state.activities.push(action)})});
 return {state,run:()=>out.reconcileBiozentRefund(tx)};
}
test('reviewed outgoing refund creates one expense preserving original payment and gross sale',async()=>{
 const f=fixture();await f.run();await f.run();assert.equal(f.state.expenses.length,1);assert.equal(f.state.expenses[0].amount,20);assert.equal(f.state.order.paid,100);assert.equal(f.state.order.total,100);assert.equal(f.state.events.length,1);assert.match(f.state.order.notes,/Líquido após devolução: 80 Bs/);assert(!f.state.order.notes.includes('CONCILIAÇÃO PENDENTE'));
});
test('matching refund expense is reused and ambiguous prior refund is not duplicated',async()=>{
 const f=fixture();f.state.expenses.push({id:'manual',description:'Estorno Biozent #164',amount:20});assert.equal((await f.run()).expenseId,'manual');assert.equal(f.state.expenses.length,1);
 const g=fixture();g.state.expenses.push({id:'unknown',description:'devolução',amount:20});assert.equal((await g.run()).skipped,'AMBIGUOUS_EXISTING_REFUND_EXPENSE');assert.equal(g.state.events.length,0);assert.equal(g.state.expenses.length,1);
});
test('absent receipt or changed order cannot create a refund expense',async()=>{
 const f=fixture();f.state.source=null;await assert.rejects(f.run(),/receipt source missing/);assert.equal(f.state.expenses.length,0);
 const g=fixture();g.state.order.paid=80;await assert.rejects(g.run(),/changed since review/);assert.equal(g.state.expenses.length,0);
});
