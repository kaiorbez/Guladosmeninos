const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,Date,Map,JSON,Number,String,Error,process:{env:{AGENT_API_TOKEN:'test-secret'}},AbortSignal,fetch:mocks.fetch,require:n=>mocks[n]||require(n)});return out;}
function fixture(){
 const state={tickets:[{id:'a',phone:'59170000001',status:'ABERTA',answer:'Resposta humana',createdAt:new Date('2026-10-18T12:00:00Z')},{id:'b',phone:'59170000002',status:'ASSUMIDA',createdAt:new Date('2026-10-19T12:00:00Z')}],orders:[213,214,215].map(number=>({id:String(number),number,customerName:'[TESTE] Claude',customerPhone:'59175678921',status:'PENDENTE',paid:0,payments:[],saleId:null})),conversations:[{phone:'59170000001',generation:5,pausedUntil:new Date(Date.now()+100000)},{phone:'59170000002',generation:9,pausedUntil:new Date(Date.now()+100000)}],events:[],activities:[]};
 const tx={$executeRaw:async()=>{},agentEvent:{findUnique:async()=>state.events[0],create:async({data})=>state.events.push(data)},agentTicket:{findUnique:async({where})=>state.tickets.find(t=>t.id===where.id),findMany:async({where})=>state.tickets.filter(t=>where.status.in.includes(t.status)&&t.createdAt<=where.createdAt.lte),updateMany:async({where,data})=>{const t=state.tickets.find(t=>t.id===where.id&&where.status.in.includes(t.status));if(!t)return {count:0};Object.assign(t,data);return{count:1};}},agentConversation:{findUnique:async({where})=>state.conversations.find(c=>c.phone===where.phone),updateMany:async({where})=>{const c=state.conversations.find(c=>c.phone===where.phone);if(c){c.pausedUntil=null;c.generation++;}return {count:c?1:0};}},order:{findMany:async()=>state.orders,update:async({where,data})=>Object.assign(state.orders.find(o=>o.id===where.id),data)}};
 const resolution=load('lib/agent/ticket-resolution.ts',{'./rules':{AgentError:Error}});
 const cleanup=load('lib/agent/owner-panel-cleanup.ts',{'./ticket-resolution':resolution,'../order-history':{recordOrderActivity:async(tx,id,action)=>state.activities.push({id,action})}});
 return {state,tx,resolution,run:()=>cleanup.cleanupPanelOctober19(tx)};
}
test('panel uses group resolution routine; duplicate click does not advance generation again',async()=>{
 const f=fixture();await f.resolution.resolveTicketInTransaction(f.tx,'a','','panel');assert.equal(f.state.tickets[0].status,'RESOLVIDA');assert.equal(f.state.conversations[0].pausedUntil,null);assert.equal(f.state.conversations[0].generation,6);
 await f.resolution.resolveTicketInTransaction(f.tx,'a','','panel');assert.equal(f.state.conversations[0].generation,6);assert.equal(f.state.tickets[1].status,'ASSUMIDA');
});
test('cleanup resolves existing tickets and cancels only reviewed unpaid test orders once',async()=>{
 const f=fixture();f.state.tickets.push({id:'new',phone:'59170000003',status:'ABERTA',createdAt:new Date('2026-10-19T15:00:00Z')});
 const r=await f.run();await f.run();assert.equal(r.resolved,2);assert.equal(f.state.tickets[2].status,'ABERTA');assert(f.state.orders.every(o=>o.status==='CANCELADA'));assert.equal(f.state.activities.length,3);assert.equal(f.state.events.length,1);assert.equal(f.state.tickets[0].answer,'Resposta humana');
});
test('unexpected real customer or payment blocks cleanup before any writes',async()=>{
 for(const update of [{customerPhone:'59179999999'},{paid:10},{payments:[{amount:10}]}]){const f=fixture();Object.assign(f.state.orders[0],update);await assert.rejects(f.run(),/divergem/);assert.equal(f.state.tickets[0].status,'ABERTA');assert.equal(f.state.events.length,0);}
});
test('resume sync cannot claim success when authenticated bridge rejects changed human state',async()=>{
 const resolution=load('lib/agent/ticket-resolution.ts',{'./rules':{AgentError:Error},fetch:async()=>({ok:true,json:async()=>({ok:false,retomado:false})})});await assert.rejects(resolution.syncPanelResume('a','59170000001',1),/não foi confirmada/);
});
