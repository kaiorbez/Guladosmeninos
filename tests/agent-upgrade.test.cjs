const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const phone='59171384295';
function load(name,mocks={}) {
 const file=path.join(__dirname,'../lib/agent',name+'.ts');
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(out,{exports,Date,URL,Set,Map,BigInt,JSON,Number,String,Array,Math,AbortSignal,process,console,fetch:mocks.fetch,require:n=>mocks[n]||(['./promotions','./ticket-resolution','./rules'].includes(n)?load(n.slice(2)):require(n))});return exports;
}
const rules=load('rules');
const today=new Date().toISOString().slice(0,10);
const future=(()=>{const d=new Date(Date.now()+7*86400000);if(d.getUTCDay()===2)d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);})();
function matches(o,w={}) {return Object.entries(w).every(([k,v])=>{
 if(k==='NOT')return !matches(o,v);
 const x=o[k];if(v&&typeof v==='object'&&!(v instanceof Date)&&!Array.isArray(v)) {
 if('startsWith' in v)return typeof x==='string'&&x.startsWith(v.startsWith);
 if('gte'in v)return x>=v.gte;if('gt'in v)return x>v.gt;
 if('in' in v)return v.in.includes(x);if('lt'in v)return x<v.lt;if('lte'in v)return x<=v.lte;
 }
 if(v instanceof Date)return +x===+v;return x===v;
});}
function fixture({network='ok',yangoFee=null}={}) {
 let state={product:[{id:'torta',name:'Torta maracujá',active:true,onStore:true,priceOnRequest:false,trackStock:false,variants:[{id:'v-torta',name:'P',price:130,active:true,stock:0}]}],agentEvent:[],agentConversation:[{phone,generation:1,latestMoment:0n,pausedUntil:null}],agentInbox:[],agentTicket:[],agentDelivery:[],order:[]};let q=Promise.resolve(),calls=0,failWrite=false;
 function db(s){const out={$executeRaw:async()=>0};for(const table of Object.keys(s))out[table]={
  findUnique:async({where})=>s[table].find(o=>matches(o,where))||null,
  findUniqueOrThrow:async({where})=>{const o=s[table].find(o=>matches(o,where));if(!o)throw Error('not found');return o;},
  findFirst:async({where})=>s[table].find(o=>matches(o,where))||null,
  findMany:async({where,take}={})=>s[table].filter(o=>matches(o,where)).slice(0,take||1000),
  create:async({data})=>{if(failWrite&&table==='agentDelivery')throw Error('storage failure');const o={id:table+'-'+s[table].length,number:s[table].length+1,createdAt:new Date(),updatedAt:new Date(),status:table==='order'?'PENDENTE':'ABERTA',agentVersion:1,reminderCount:0,consumedAt:null,ready:false,...data};if(s[table].some(x=>data.key&&x.key===data.key))throw Error('unique');s[table].push(o);return o;},
  update:async({where,data})=>{const o=s[table].find(o=>matches(o,where));if(!o)throw Error('not found');for(const[k,v]of Object.entries(data))o[k]=v&&typeof v==='object'&&'increment'in v?(o[k]||0)+v.increment:v;return o;},
  updateMany:async({where,data})=>{let count=0;for(const o of s[table].filter(o=>matches(o,where))){for(const[k,v]of Object.entries(data))o[k]=v&&typeof v==='object'&&'increment'in v?(o[k]||0)+v.increment:v;count++;}return {count};},
  upsert:async({where,create,update})=>{const old=s[table].find(o=>matches(o,where));return old?out[table].update({where,data:update}):out[table].create({data:create});},
 };return out;}
 const prisma=new Proxy({}, {get(_,k){if(k==='$transaction')return fn=>{const task=q.then(async()=>{const copy=structuredClone(state);const r=await fn(db(copy));state=copy;return r;});q=task.catch(()=>{});return task;};return db(state)[k];}});
 const env=['ZAPI_INSTANCE','ZAPI_TOKEN','ZAPI_CLIENT_TOKEN','WHATSAPP_EQUIPE'];for(const e of env)process.env[e]='test';
 const transport=load('transport',{'@/lib/db':{prisma},'./rules':rules,fetch:async()=>{calls++;if(network==='timeout')throw Error('timeout');return {ok:network==='ok',status:network==='ok'?200:400,json:async()=>network==='ok'?{messageId:'sent-'+calls}:{error:'failed'}};}});
 let receiptPayments=0;
 const service=load('service',{'@/lib/db':{prisma},'./rules':rules,'./receipt-carry':load('receipt-carry'),'./quoted-prices':load('quoted-prices'),'./review':load('review',{'./rules':rules}),'./notices':load('notices'),'./conversation-context':load('conversation-context'),'./catalog-context':load('catalog-context'),'./yango':{lookupYangoFee:async()=>yangoFee},'./transport':transport,'./identity':load('identity',{'@/lib/db':{prisma},'./transport':transport}),'./history':{importHistory:async()=>{}},'./payments':{recordReceiptPayment:async()=>{receiptPayments++;return {ok:true};}}});
 return {prisma,service,transport,state:()=>state,calls:()=>calls,receiptPayments:()=>receiptPayments,failWrite:()=>{failWrite=true;}};
}
const order=()=>({cliente:'Cliente',data:future,horario:'17:00',modalidade:'ENTREGA',endereco:'Torre, 13D',itens:[{variantId:'v-torta',descricao:'Torta maracujá P',quantidade:1,precoUnitario:130}]});
const body=()=>({telefone:phone,messageId:'m1',geracao:1,pedido:order()});

test('quitação antecipada cobra saldo real sem alterar pagamentos e é idempotente',async()=>{
 const f=fixture();const saved=await f.service.saveOrder(body());const id=saved.pedido.id;
 await f.prisma.order.update({where:{id},data:{paid:65}});
 const normal=await f.service.operate({acao:'qr',telefone:phone,messageId:'normal',pedidoId:id,geracao:1});
 assert.equal(normal.enviado,false);assert.equal(normal.saldo,65);
 const q={acao:'qr',telefone:phone,messageId:'restante',pedidoId:id,geracao:1,quitarSaldo:true,arquivoUrl:'https://example.com/qr.png'};
 const result=await f.service.operate(q);assert.equal(result.pagarAgora,65);assert.equal(result.enviado,true);
 const version=f.state().order[0].agentVersion;await f.service.operate(q);
 assert.equal(f.state().order[0].agentVersion,version);assert.equal(f.state().order[0].paid,65);assert.equal(f.state().order[0].total,130);assert.equal(f.receiptPayments(),0);
});

test('pedido quitado não gera novo QR e geração antiga não altera plano',async()=>{
 const f=fixture();const saved=await f.service.saveOrder(body());const id=saved.pedido.id;
 const q={acao:'qr',telefone:phone,messageId:'restante',pedidoId:id,geracao:0,quitarSaldo:true};
 await assert.rejects(f.service.operate(q),/Nova mensagem/);assert.equal(f.state().order[0].payFull,false);
 await f.prisma.order.update({where:{id},data:{paid:130}});
 const result=await f.service.operate({...q,geracao:1});assert.equal(result.enviado,false);assert.equal(result.saldo,0);assert.equal(f.state().order[0].payFull,false);
});

test('falha da IA inclui solicitação real sem expor erro bruto',async()=>{
 const f=fixture(),id='failure-request';
 await f.prisma.agentEvent.create({data:{key:`in:${phone}:${id}`,phone,kind:'INBOUND',payload:{fromMe:false,text:'Queria o QR para pagar o restante'}}});
 await f.prisma.agentInbox.create({data:{id:`in:${phone}:${id}`,phone,messageId:id,mediaKind:'texto',content:'Queria o QR para pagar o restante',ready:true,consumedAt:new Date()}});
 await f.service.analysisFailure({telefone:phone,messageId:id,geracao:1,etapa:'ia',erro:'SECRET INTERNAL STACK'});
 assert.match(f.state().agentTicket[0].question,/Queria o QR para pagar o restante/);assert(!f.state().agentTicket[0].question.includes('SECRET'));assert.match(f.state().agentTicket[0].question,/não concluiu a resposta/);
});

test('citação do anúncio chega ao lote atual sem duplicar nem reabrir conteúdo consumido',async()=>{
 const f=fixture();const id='reply-kit',quote='KIT FIESTA P YA ESTÁ AQUÍ';
 await f.prisma.agentEvent.create({data:{key:`in:${phone}:${id}`,phone,kind:'INBOUND',payload:{quoted:quote}}});
 await f.prisma.agentInbox.create({data:{id:`in:${phone}:${id}`,phone,messageId:id,mediaKind:'texto',moment:1n}});
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:id,texto:'Teria disponível para amanhã?'});
 const result=await f.service.prepare({telefone:phone,execucao:'reply-kit-test'});
 assert.match(result.message,/Teria disponível/);assert.match(result.message,/KIT FIESTA P/);
 assert.equal(result.message.split(quote).length,2);
 const retry=await f.service.operate({acao:'conteudo',telefone:phone,messageId:id,texto:'outro texto'});
 assert.equal(retry.atualizado,false);assert.match(f.state().agentInbox[0].content,/KIT FIESTA P/);
});

test('citação já incluída na análise não é repetida',async()=>{
 const f=fixture(),id='quoted-media',quote='Kit Fiesta M';
 await f.prisma.agentEvent.create({data:{key:`in:${phone}:${id}`,phone,kind:'INBOUND',payload:{quoted:quote}}});
 await f.prisma.agentInbox.create({data:{id:`in:${phone}:${id}`,phone,messageId:id,mediaKind:'imagem',moment:1n}});
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:id,texto:'Referência: '+quote});
 assert.equal(f.state().agentInbox[0].content,'Referência: '+quote);
});
test('test reset clears pause and buffered input but preserves orders and history',async()=>{
 const f=fixture();await f.service.saveOrder(body());await f.prisma.agentConversation.update({where:{phone},data:{pausedUntil:new Date(Date.now()+60000)}});
 await f.prisma.agentInbox.create({data:{phone,messageId:'buffer',content:'texto'}});
 const r=await f.service.operate({acao:'reiniciarAtendimento',telefone:phone,messageId:'reset-1',geracao:1});
 assert.equal(r.retomado,true);assert.equal(f.state().agentConversation[0].pausedUntil,null);assert.equal(f.state().order.length,1);assert.ok(f.state().agentInbox[0].consumedAt);
 await f.service.operate({acao:'reiniciarAtendimento',telefone:phone,messageId:'reset-1',geracao:1});assert.equal(f.state().agentConversation[0].generation,2);
 await assert.rejects(f.service.operate({acao:'reiniciarAtendimento',telefone:phone,messageId:'reset-2',geracao:1}),/Atendimento mudou/);
});
test('venda padrão de quatro itens registra 115 Bs e envia QR sem dúvida humana',async()=>{
 const f=fixture();const prices=[35,30,30,20];
 f.state().product=prices.map((price,i)=>({id:'p'+i,name:'Item '+i,active:true,onStore:true,priceOnRequest:false,trackStock:true,variants:[{id:'v'+i,name:'Único',price,active:true,stock:3}]}));
 const pedido={...order(),pagarIntegral:true,itens:prices.map((precoUnitario,i)=>({variantId:'v'+i,descricao:'Item '+i,quantidade:1,precoUnitario}))};
 const saved=await f.service.saveOrder({...body(),pedido});
 assert.equal(saved.registrado,true);assert.equal(saved.pedido.total,115);assert.equal(saved.pedido.pagarAgora,115);assert.equal(f.state().agentTicket.length,0);
 const qr=await f.service.operate({acao:'qr',telefone:phone,messageId:'m1',geracao:1,pedidoId:saved.pedido.id,arquivoUrl:'https://example.com/qr.png',idioma:'es'});
 assert.equal(qr.enviado,true);assert.equal(f.calls(),1);assert.equal(f.state().agentTicket.length,0);
 const retry=await f.service.saveOrder({...body(),pedido});assert.equal(retry.pedido.id,saved.pedido.id);assert.equal(f.state().order.length,1);
 assert.equal(rules.paymentPlan(115,0,'2026-10-08',false,new Date('2026-10-08T19:20:00Z')).pagarAgora,115);
});
test('preço alterado e item sob consulta continuam bloqueados antes de cobrar',async()=>{
 const f=fixture();let b=body();b.pedido.itens[0].precoUnitario=1;await assert.rejects(f.service.saveOrder(b),/Preço mudou/);
 f.state().product[0].priceOnRequest=true;await assert.rejects(f.service.saveOrder(body()),/sem preço autorizado/);
 assert.equal(f.state().order.length,0);assert.equal(f.calls(),0);
});
test('planejar catálogo não envia e rejeita geração antiga ou pausa humana',async()=>{
 const f=fixture();const r=await f.service.operate({acao:'planejarMenu',telefone:phone,geracao:1});
 assert.equal(r.planejado,true);assert.equal(r.enviado,false);assert.equal(f.calls(),0);
 await assert.rejects(f.service.operate({acao:'planejarMenu',telefone:phone,geracao:0}));
 await f.prisma.agentConversation.update({where:{phone},data:{pausedUntil:new Date(Date.now()+60000)}});
 await assert.rejects(f.service.operate({acao:'planejarMenu',telefone:phone,geracao:1}));assert.equal(f.calls(),0);
});

test('preço consultado na Yango acompanha o link sem tarifa digitada pela equipe',async()=>{
 const f=fixture({yangoFee:8});const t=await f.service.ticket({telefone:phone,messageId:'m',geracao:1,pergunta:'Entrega por Yango'});
 await f.service.team({grupo:'test',referenceMessageId:t.messageId,messageId:'staff',texto:'https://delivery.yango.com/route/#691c5717-0fdb-41e7-8019-c75c3bfd5ae6'});
 assert.match(f.state().agentDelivery.at(-1).body.message,/Valor da entrega: 8 Bs/);assert.equal(f.state().agentEvent.at(-1).payload.fonteValor,'YANGO');assert.equal(f.receiptPayments(),0);
});

test('consulta pública Yango lê apenas preço de entrega e falha sem inventar tarifa',async()=>{
 let calls=0;
 const response={content_sections:[{items:[{type:'details',sections:[{items:[{title:'Bs8\u202f',subtitle:'Precio'},{title:'Total pedido Bs20',subtitle:'Instrucciones'}]}]},{title:{text:'Bs99'},type:'header'}]}]};
 const y=load('yango',{'./rules':rules,fetch:async()=>{calls++;return {ok:true,json:async()=>response};}});
 const link='https://delivery.yango.com/route/#691c5717-0fdb-41e7-8019-c75c3bfd5ae6';
 assert.equal(await y.lookupYangoFee(link),8);assert.equal(calls,1);assert.equal(y.yangoFeeFromResponse({title:'Bs999'}),null);
 assert.equal(await y.lookupYangoFee('https://delivery.yango.com/route/#invalid'),null);assert.equal(calls,1);
 response.content_sections[0].items[0].sections[0].items.push({title:'Bs10',subtitle:'Precio'});assert.equal(y.yangoFeeFromResponse(response),null);
 const fail=load('yango',{'./rules':rules,fetch:async()=>{throw Error('timeout');}});assert.equal(await fail.lookupYangoFee(link),null);
 await assert.rejects(y.lookupYangoFee('https://delivery.yango.com.evil.test/route/#abc'),/acompanhamento/);
});

test('Yango informa tarifa explícita, preserva idioma e não contabiliza frete como pagamento',async()=>{
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'m',geracao:1,pergunta:'Entrega por Yango'});
 await f.service.team({grupo:'test',referenceMessageId:t.messageId,messageId:'staff',texto:'https://delivery.yango.com/route/#abc\nEntrega: 12,50 Bs'});
 assert.match(f.state().agentDelivery.at(-1).body.message,/Valor da entrega: 12,50 Bs/);assert.equal(f.receiptPayments(),0);assert.equal(f.state().agentEvent.at(-1).payload.valorEntrega,12.5);
 const review=load('review',{'./rules':rules});assert.match(review.closeMessage('es','https://delivery.yango.com/route/#abc',15),/Costo del envío: 15 Bs/);
 assert.equal(review.deliveryFee('Total pedido: 130 Bs\nhttps://delivery.yango.com/route/#12345'),null);
 assert.equal(review.deliveryFee('https://delivery.yango.com/route/#abc\n15 Bs'),15);assert.equal(review.deliveryFee('Entrega: 0 Bs'),0);
 assert.throws(()=>review.deliveryFee('Entrega: 15 Bs\nFrete: 20 Bs'),/divergentes/);
 assert.doesNotMatch(review.closeMessage('pt','https://delivery.yango.com/route/#abc'),/Valor da entrega/);
});

test('resposta a outra resposta vinculada resolve entrega sem alterar pedido ou pagamento',async()=>{
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'m',geracao:1,pergunta:'Confirmar entrega por Yango'});
 await f.service.team({grupo:'test',referenceMessageId:t.messageId,messageId:'staff1',texto:'Vou verificar'});
 const r=await f.service.team({grupo:'test',referenceMessageId:'staff1',messageId:'staff2',texto:'Sim, já foi enviado. Não precisa mais notificar'});
 assert.equal(r.retomado,true);assert.equal(f.state().agentTicket[0].status,'RESOLVIDA');assert.equal(f.calls(),1);assert.equal(f.receiptPayments(),0);
});

test('entrega não enviada não resolve aviso nem comprova pagamento',async()=>{
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'m',geracao:1,pergunta:'Entrega por Yango'});
 await f.service.team({grupo:'test',referenceMessageId:t.messageId,messageId:'staff',texto:'Não foi enviado ainda'});
 assert.equal(f.state().agentTicket[0].status,'ASSUMIDA');assert.equal(f.receiptPayments(),0);
});

test('texto retido durante pausa recupera localização original sem inventar análise de imagem',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'location-text',midia:'texto',texto:'Ubicación: https://maps.google.com/?q=-17,-63',momento:Date.now()-20*60000});
 f.state().agentInbox[0].createdAt=new Date(Date.now()-20*60000);
 const p=await f.service.prepare({telefone:phone,execucao:'resume'});assert.match(p.message,/Ubicación/);assert.doesNotMatch(p.message,/Falha anterior/);assert.match(p.contextoConversa.localizacaoRecebida,/maps.google.com/);assert.equal(f.calls(),0);
 const g=fixture();await g.service.inbound({telefone:phone,messageId:'image',midia:'imagem',texto:'Comprovante',momento:Date.now()-20*60000});g.state().agentInbox[0].createdAt=new Date(Date.now()-20*60000);
 const image=await g.service.prepare({telefone:phone,execucao:'resume'});assert.match(image.message,/conteúdo indisponível/);assert.equal(g.receiptPayments(),0);
});

test('lembrete de entrega usa painel atual, resposta anterior e localização em vez de falha antiga',async()=>{
 const f=fixture();
 f.state().order.push({id:'existing-order-15',number:15,customerPhone:phone,customerName:'Yoselin',product:'Bolo P',total:130,paid:130,deliveryDate:new Date(today+'T00:00:00Z'),deliveryTime:'15:00',status:'ENTREGUE',payFull:false});
 f.state().agentEvent.push({key:'history:human',phone,kind:'HISTORY',createdAt:new Date(Date.now()-60000),payload:{fromMe:true,text:'Claroo, el próximo envio.',messageId:'h'}});
 f.state().agentInbox.push({id:'loc',phone,messageId:'loc',ready:true,moment:BigInt(Date.now()-30000),content:'Localização https://maps.google.com/?q=-17,-63'});
 f.state().agentTicket.push({id:'old-ticket',phone,customerName:'Yoselin',status:'ABERTA',kind:'DUVIDA',question:'Pedido nº15: Cliente enviou 3 mídias não analisadas. Entrega por Yango. Saldo no painel: 10 Bs.',reminderCount:0,nextReminderAt:new Date(0)});
 await f.service.reminders();const notice=f.state().agentDelivery[0].body.message;
 assert.match(notice,/ENTREGUE/);assert.match(notice,/Pago confirmado: 130 Bs/);assert.match(notice,/Saldo: 0 Bs/);assert.match(notice,/Claroo, el próximo envio/);assert.match(notice,/maps.google.com/);
 assert.doesNotMatch(notice,/Saldo no painel: 10|3 mídias|existing-order-15/);assert.equal(f.receiptPayments(),0);assert.equal(f.state().order[0].status,'ENTREGUE');
});

test('fatos de contexto distinguem resposta humana, IA e falha anterior, mantendo histórico completo',async()=>{
 const f=fixture();f.state().agentEvent.push({key:'in:'+phone+':human',phone,kind:'INBOUND',createdAt:new Date(),payload:{fromMe:true,text:'No próximo envio',moment:Date.now()-60000}});
 f.state().agentInbox.push({id:'old',phone,messageId:'old',ready:true,moment:BigInt(Date.now()-20000),content:'[Mensagem/mídia recebida não pôde ser analisada.]'},{id:'thanks',phone,messageId:'thanks',ready:true,moment:BigInt(Date.now()),content:'Muchas gracias'});
 f.state().agentDelivery.push({key:'reply',phone,status:'SENT',messageId:'bot',createdAt:new Date(),body:{message:'Preciso ver com a equipe'}});
 const c=await f.service.context(phone);assert.equal(c.contextoConversa.ultimaRespostaAnterior.texto,'No próximo envio');assert.equal(c.contextoConversa.ultimaMensagemCliente.texto,'Muchas gracias');assert.equal(c.contextoConversa.falhasAnterioresDeAnalise,1);assert.equal(c.historico.length,4);
 assert.equal(c.historico.find(m=>m.origem==='humano').data,new Date(f.state().agentEvent[0].payload.moment).toISOString());
});

test('resposta comum vinculada assume pendência, cancela lembrete e bloqueia resposta atrasada',async()=>{
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'doubt',geracao:1,pergunta:'Entrega hoje?'});
 const b={grupo:'test',referenceMessageId:t.messageId,messageId:'staff',texto:'Vou verificar com o cliente'};
 const r=await f.service.team(b);assert.equal(r.assumido,true);assert.equal(f.state().agentTicket[0].status,'ASSUMIDA');
 assert.equal(f.state().agentTicket[0].resolvedAt,undefined);assert.equal(f.state().agentConversation[0].generation,2);
 await f.service.team(b);assert.equal(f.state().agentConversation[0].generation,2);
 f.state().agentTicket[0].nextReminderAt=new Date(0);await f.service.reminders();assert.equal(f.calls(),1);
 const cancelled=await f.transport.sendOnce('reminder:stale:0','test','Lembrete',t.ticketId);assert.equal(cancelled.estado,'CANCELLED');assert.equal(f.calls(),1);
 const stale=await f.transport.sendOnce('reply:stale',phone,'Resposta atrasada',undefined,1);assert.equal(stale.estado,'SUPERADA');assert.equal(f.calls(),1);
 await f.service.team({...b,messageId:'done',texto:'Resolvido'});assert.equal(f.state().agentTicket[0].status,'RESOLVIDA');assert.equal(f.state().agentConversation[0].pausedUntil,null);
});

test('humano no privado suspende apenas pendências do cliente sem confirmar pagamento',async()=>{
 const f=fixture();f.state().agentTicket.push({id:'a',phone,status:'ABERTA',kind:'COMPROVANTE'},{id:'b',phone:'59170000000',status:'ABERTA',kind:'DUVIDA'});
 await f.service.inbound({telefone:phone,messageId:'human',humano:true,texto:'Já estou atendendo',momento:Date.now()});
 assert.equal(f.state().agentTicket[0].status,'ASSUMIDA');assert.equal(f.state().agentTicket[1].status,'ABERTA');assert.equal(f.receiptPayments(),0);
});

test('resposta antiga e callback repetido não assumem uma pendência nova',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'human',humano:true,momento:Date.now()});
 f.state().agentTicket.push({id:'new',phone,status:'ABERTA'});
 await f.service.inbound({telefone:phone,messageId:'human',humano:true,momento:Date.now()});
 await f.service.inbound({telefone:phone,messageId:'old-human',humano:true,momento:Date.now()-60000});
 assert.equal(f.state().agentTicket[0].status,'ABERTA');
});

test('conversa de grupo sem vínculo e eco automático não assumem clientes',async()=>{
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'doubt',geracao:1,pergunta:'Entrega?'});
 assert.equal((await f.service.team({grupo:'test',referenceMessageId:'unrelated',messageId:'staff',texto:'Estou verificando'})).ignorar,true);
 assert.equal((await f.service.team({grupo:'test',referenceMessageId:t.messageId,messageId:'echo',texto:'Aviso automático',fromApi:true})).ignorar,true);
 assert.equal(f.state().agentTicket[0].status,'ABERTA');assert.equal(f.calls(),1);
});

test('falha de mídia registra pendência, responde sem IA e deduplica callbacks concorrentes',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'photo',midia:'imagem',texto:'precio',momento:Date.now()});
 const b={acao:'falhaAnalise',telefone:phone,messageId:'photo',geracao:2,etapa:'imagem',idioma:'es'};
 const results=await Promise.all([f.service.operate(b),f.service.operate(b)]);
 assert(results.every(r=>r.registrado));assert(results.every(r=>!r.enviado));assert.equal(f.state().agentTicket.length,1);assert.equal(f.calls(),1);
 assert(f.state().agentInbox[0].consumedAt);assert.equal(f.state().agentConversation[0].generation,3);
 assert(!f.state().agentDelivery.some(d=>d.phone===phone));
 assert.equal(f.state().order.length,0);
});

test('falha antiga após resposta humana não altera fila nem envia aviso',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'photo',midia:'imagem',momento:Date.now()});
 await f.service.inbound({telefone:phone,messageId:'human',humano:true,momento:Date.now()});
 await assert.rejects(f.service.analysisFailure({telefone:phone,messageId:'photo',geracao:2,etapa:'imagem'}),/Nova mensagem/);
 assert.equal(f.calls(),0);assert.equal(f.state().agentTicket.length,0);assert.equal(f.state().agentInbox[0].ready,false);
});

test('timeout do aviso técnico mantém pendência e não repete envios incertos',async()=>{
 const f=fixture({network:'timeout'});await f.service.inbound({telefone:phone,messageId:'audio',midia:'audio',momento:Date.now()});
 const b={telefone:phone,messageId:'audio',geracao:2,etapa:'audio'};
 const r=await f.service.analysisFailure(b);assert.equal(r.enviado,false);assert.equal(r.notificacaoEnviada,false);
 await f.service.analysisFailure(b);assert.equal(f.calls(),1);assert.equal(f.state().agentTicket.length,1);
});

test('falha da IA preserva lote consumido e resposta humana impede callback atrasado',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'text',midia:'texto',momento:Date.now()});
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:'text',texto:'Quero bolo'});
 await f.service.prepare({telefone:phone,execucao:'run'});
 const b={telefone:phone,messageId:'text',geracao:2,etapa:'ia'};
 const r=await f.service.analysisFailure(b);assert(!r.enviado);assert(r.notificacaoEnviada);assert.equal(f.state().agentInbox[0].content,'Quero bolo');assert(f.state().agentInbox[0].consumedAt);
 await f.service.resolveTicket(r.ticketId,'','grupo');await f.service.analysisFailure(b);assert.equal(f.calls(),1);assert.equal(f.state().agentTicket[0].status,'RESOLVIDA');
});

test('erro tardio não substitui análise de mídia já concluída',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'photo',midia:'imagem',momento:Date.now()});
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:'photo',texto:'REFERENCIA_BOLO'});
 await assert.rejects(f.service.analysisFailure({telefone:phone,messageId:'photo',geracao:2,etapa:'imagem'}),/já processada/);
 assert.equal(f.state().agentInbox[0].content,'REFERENCIA_BOLO');assert.equal(f.calls(),0);
});
test('hoje 100%; futuro 50%; madrugada usa La Paz; desconta só valor confirmado',()=>{
 const now=new Date('2026-10-04T02:00:00Z');
 assert.equal(rules.paymentPlan(130,0,'2026-10-03',false,now).pagarAgora,130);
 assert.equal(rules.paymentPlan(130,0,'2026-10-04',false,now).pagarAgora,65);
 assert.equal(rules.paymentPlan(130,65,'2026-10-03',false,now).pagarAgora,65);
 assert.equal(rules.paymentPlan(130,0,'2026-10-04',true,now).pagarAgora,130);
});
test('datas inválidas/passadas e itens sem preço são rejeitados',()=>{
 assert.throws(()=>rules.dateOnly('2026-02-30'));
 assert.throws(()=>rules.orderInput({...order(),data:'2020-01-01'}));
 assert.throws(()=>rules.orderInput({...order(),itens:[{descricao:'Bolo',quantidade:1,precoUnitario:-1}]}));
});
test('pedido aceito é persistido sem confirmar pagamento ou gerar receita',async()=>{
 const f=fixture();const r=await f.service.saveOrder(body());assert(r.registrado);assert.equal(f.state().order[0].paid,0);assert.equal(r.pedido.pagarAgora,65);assert.equal(r.pagamentoConfirmado,false);
});
test('registro concorrente e repetido não cria outra encomenda',async()=>{
 const f=fixture();await Promise.all([f.service.saveOrder(body()),f.service.saveOrder(body())]);await f.service.saveOrder({...body(),messageId:'m2'});assert.equal(f.state().order.length,1);
});
test('alteração usa mesma ficha e versão; não acessa pedido de outro telefone',async()=>{
 const f=fixture();const r=await f.service.saveOrder(body());const b={...body(),messageId:'m2',pedido:{...order(),id:r.pedido.id,versao:1,endereco:'Novo endereço'}};await f.service.saveOrder(b);assert.equal(f.state().order.length,1);assert.equal(f.state().order[0].deliveryAddress,'Novo endereço');await assert.rejects(f.service.saveOrder({...b,messageId:'m3'}),/alterado/);
 f.state().order[0].customerPhone='5511999999999';await assert.rejects(f.service.saveOrder({...b,messageId:'m4'}),/não encontrada/);
});
test('geração antiga impede registro e envio de resposta',async()=>{
 const f=fixture();f.state().agentConversation[0].generation=2;
 await assert.rejects(f.service.saveOrder(body()),/Nova mensagem/);
 const r=await f.transport.sendOnce('reply:x',phone,'Qual horário?',undefined,1);assert.equal(r.estado,'SUPERADA');assert.equal(f.calls(),0);
});
test('envio concorrente é feito uma só vez',async()=>{
 const f=fixture();await Promise.all([f.transport.sendOnce('reply:x',phone,'Olá',undefined,1),f.transport.sendOnce('reply:x',phone,'Olá',undefined,1)]);assert.equal(f.calls(),1);assert.equal(f.state().agentDelivery[0].status,'SENT');
});
test('timeout é incerto e nunca reenvia automaticamente',async()=>{
 const f=fixture({network:'timeout'});const r=await f.transport.sendOnce('reply:x',phone,'Olá',undefined,1);assert.equal(r.estado,'UNKNOWN');await f.transport.sendOnce('reply:x',phone,'Olá',undefined,1);assert.equal(f.calls(),1);
});
test('falha de persistência impede envio',async()=>{
 const f=fixture();f.failWrite();await assert.rejects(f.transport.sendOnce('reply:x',phone,'Olá',undefined,1));assert.equal(f.calls(),0);
});
test('erro 11: localização ou texto aqui não é comprovante',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'loc',momento:Date.now(),texto:'Aqui',midia:'localizacao'});
 await assert.rejects(f.service.ticket({telefone:phone,messageId:'loc',geracao:2,mediaIds:['loc'],tipo:'COMPROVANTE',pergunta:'Recebido'}),/não é comprovante/);
 assert.equal(f.state().agentTicket.length,0);assert.equal(f.calls(),0);
});
test('erros 7–8: dúvida persiste no painel mesmo quando notificação falha',async()=>{
 const f=fixture({network:'timeout'});const r=await f.service.ticket({telefone:phone,messageId:'m1',geracao:1,pergunta:'Tem abacaxi com coco hoje?'});
 assert.equal(r.registrado,true);assert.equal(r.notificacaoEnviada,false);assert.equal(f.state().agentTicket.length,1);
});
test('Respondido resolve pendência e libera atendimento sem inventar resposta',async()=>{
 const f=fixture();const r=await f.service.ticket({telefone:phone,messageId:'m1',geracao:1,pergunta:'Tem abacaxi?'});f.state().agentConversation[0].pausedUntil=new Date(Date.now()+100000);
 await f.service.team({grupo:'test',referenceMessageId:r.messageId,messageId:'team1',texto:'Respondido'});
 assert.equal(f.state().agentTicket[0].status,'RESOLVIDA');assert.equal(f.state().agentConversation[0].pausedUntil,null);assert.equal(f.state().agentTicket[0].answer,null);
});
test('Yango usa cliente do aviso, encerra após sucesso e não repete link',async()=>{
 const f=fixture();const r=await f.service.ticket({telefone:phone,messageId:'m1',geracao:1,pergunta:'Pedido'});
 const b={grupo:'test',referenceMessageId:r.messageId,messageId:'team1',texto:'https://delivery.yango.com/route/#abc'};
 assert.equal((await f.service.team(b)).enviado,true);await f.service.team({...b,messageId:'team2'});assert.equal(f.calls(),2);assert.equal(f.state().agentDelivery[1].phone,phone);assert.equal(f.state().agentTicket[0].status,'RESOLVIDA');
});
test('Yango não aceita host parecido, grupo errado ou aviso sem vínculo',async()=>{
 assert.throws(()=>rules.yangoUrl('https://delivery.yango.com.evil.test/route/#a'));
 const f=fixture();await assert.rejects(f.service.team({grupo:'outro'}),/Grupo/);await assert.rejects(f.service.team({grupo:'test',referenceMessageId:'unknown',messageId:'m1',texto:'https://delivery.yango.com/route/#a'}),/vinculado/);
});
test('duas execuções consomem lote uma só vez e aguardam análise de mídia',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'m1',midia:'imagem',momento:Date.now()});
 assert.equal((await f.service.prepare({telefone:phone,execucao:'e1'})).processar,false);
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:'m1',texto:'Foto de bolo'});
 const r=await Promise.all([f.service.prepare({telefone:phone,execucao:'e1'}),f.service.prepare({telefone:phone,execucao:'e2'})]);assert.equal(r.filter(x=>x.processar).length,1);
});
test('histórico inclui pedido antigo e exclui mensagem que falhou ao enviar',async()=>{
 const f=fixture();await f.service.saveOrder(body());f.state().order[0].deliveryDate=new Date('2026-01-01');
 f.state().agentDelivery.push({phone,status:'UNKNOWN',createdAt:new Date(),body:{message:'Falsa confirmação'}});
 const r=await f.service.context(phone);assert.equal(r.pedidos.length,1);assert(!r.historico.some(m=>m.texto==='Falsa confirmação'));
});
test('comprovante exige classificação e encaminha original junto do resumo estruturado',async()=>{
 const f=fixture();const o=await f.service.saveOrder(body());
 await f.service.inbound({telefone:phone,messageId:'receipt',momento:Date.now(),midia:'imagem',midiaUrl:'https://example.com/receipt.png'});
 const b={telefone:phone,messageId:'receipt',geracao:2,mediaIds:['receipt'],tipo:'COMPROVANTE',pergunta:'Dados visíveis',cliente:'Cliente'};
 await assert.rejects(f.service.ticket(b),/Classifique/);
 const r=await f.service.ticket({...b,comprovante:{tipo:'COMPROVANTE_BANCARIO',pedidoId:o.pedido.id,valor:65,moeda:'Bs',beneficiario:'Lazzarini Franca Matheus',bancoDestino:'Banco Ganadero',data:rules.dayLaPaz(),hora:'16:45'}});
 assert.equal(r.midiaEnviada,true);assert.equal(r.notificacaoEnviada,true);
 const d=f.state().agentDelivery.find(d=>d.key==='ticket:'+r.ticketId);assert.match(d.body.message,/GULA — AVISO DO AGENTE/);assert.match(d.body.message,/✅ CONFERE/);assert.match(d.body.message,/Pagar agora: 65 Bs/);assert.equal(f.state().order[0].paid,0);
 assert(f.state().agentDelivery.some(d=>d.body.media==='receipt-image'));
});
test('comprovante sem original disponível sinaliza falha de mídia, não sucesso',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'r',midia:'pdf',momento:Date.now()});
 const r=await f.service.ticket({telefone:phone,messageId:'r',geracao:2,mediaIds:['r'],tipo:'COMPROVANTE',pergunta:'Dados',comprovante:{tipo:'COMPROVANTE_BANCARIO'}});assert.equal(r.midiaEnviada,false);
});

test('comprovante sem pedido preserva contexto da compra sem registrar venda ou pagamento',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'receipt-context',midia:'imagem',momento:Date.now()});
 await f.service.ticket({telefone:phone,messageId:'receipt-context',geracao:2,mediaIds:['receipt-context'],tipo:'COMPROVANTE',pergunta:'Cliente solicitou 1 fatia e 1 pote por 50 Bs, enviou localização. Compra na terça precisa de conferência.',comprovante:{tipo:'COMPROVANTE_BANCARIO',valor:50,moeda:'Bs',beneficiario:'Lazzarini Franca Matheus',bancoDestino:'Banco Ganadero',data:rules.dayLaPaz()}});
 const report=f.state().agentTicket[0].question;
 assert.match(report,/1 fatia e 1 pote/);assert.match(report,/não é pedido registrado/);assert.match(report,/Valor: 50 Bs/);assert.doesNotMatch(report,/Pedido não identificado|Modalidade\/endereço não identificado/);
 assert.equal(f.state().order.length,0);assert.equal(f.receiptPayments(),0);
});
test('comprovante sem pedido não repete as seções que a IA já escreveu',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'dup',midia:'imagem',momento:Date.now()});
 const ctx='📌 Resumo\nNÃO FOI POSSÍVEL CONFERIR: sem pedido.\n\n🛒 Pedido\nKit Fiesta P (160 Bs) para 17/10 às 16:00.\n\n🧾 Comprovante mostra\nValor: 100 Bs.\n\n👉 Ação da equipe\nVincular.';
 await f.service.ticket({telefone:phone,messageId:'dup',geracao:2,mediaIds:['dup'],tipo:'COMPROVANTE',pergunta:ctx,comprovante:{tipo:'COMPROVANTE_BANCARIO',valor:100,moeda:'Bs',beneficiario:'Lazzarini Franca Matheus',bancoDestino:'Banco Ganadero',data:rules.dayLaPaz()}});
 const report=f.state().agentTicket[0].question;
 assert.match(report,/Kit Fiesta P/);for(const h of ['Resumo','Comprovante mostra','Ação da equipe'])assert.equal(report.split(h).length-1,1,h);
});
test('valor divergente e destinatário errado nunca geram CONFERE',()=>{
 const review=load('review',{'./rules':rules});const r=review.receiptReview({valor:10,moeda:'Bs',beneficiario:'Outra pessoa',bancoDestino:'Outro banco',data:today},20,today);
 assert(r.alertas.length>=3);assert.equal(r.pagamentoConfirmado,false);
 const msg=review.receiptNotice({valor:10,moeda:'Bs'},null,r);assert(!msg.includes('✅ CONFERE'));assert.match(msg,/Pedido não identificado/);
});
test('resolução repetida de aviso antigo preserva nova pausa humana',async()=>{
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'m1',geracao:1,pergunta:'Dúvida'});
 const b={grupo:'test',referenceMessageId:t.messageId,messageId:'team1',texto:'Resolvido'};
 assert.equal((await f.service.team(b)).retomado,true);
 const c=f.state().agentConversation[0];c.pausedUntil=new Date(Date.now()+60000);const generation=c.generation;
 assert.equal((await f.service.team({...b,messageId:'team2'})).retomado,false);
 assert.ok(f.state().agentConversation[0].pausedUntil);assert.equal(f.state().agentConversation[0].generation,generation);
});

test('avisos e lembretes ocultam ID interno e horário técnico sem perder dados do pedido',()=>{
 const notices=load('notices');
 const question='📌 *Resumo*\nCliente pediu 15:30 e depois (20:36) solicitou envio.\n\n🛒 *Pedido*\nPedido nº15 (id cmutxmmvu001ens3caqjcunjj): Bolo P. Total 130 Bs.\n\n📅 *Data e horário*\n2026-10-04. Horário no painel: 15:00.\n\n🚚 *Entrega*\nhttps://maps.google.com/?q=-17.834,-63.166';
 for(const reminder of [false,true]){
  const result=notices.pendingNotice('DUVIDA','Cliente',phone,question,reminder);
  assert(!result.includes('cmutxmmvu001ens3caqjcunjj'));assert(!result.includes('20:36'));
  for(const data of ['Pedido nº15','130 Bs','2026-10-04','15:30','15:00','https://maps.google.com/?q=-17.834,-63.166'])assert(result.includes(data));
 }
 assert.equal(notices.teamDisplay('Entrega (15:30). Hora do comprovante: (11:04). Retirada às (16:00).'),'Entrega (15:30). Hora do comprovante: (11:04). Retirada às (16:00).');
 assert.equal(notices.teamDisplay('pedidoId: cmutxmmvu001ens3caqjcunjj. Pedido nº15.'),'. Pedido nº15.');
});

test('data de comprovante exige dia real em ISO; data ausente, ilegível ou impossível não é compatível',()=>{
 const review=load('review',{'./rules':rules});
 const receipt={valor:50,moeda:'Bs',beneficiario:'Lazzarini Franca Matheus',bancoDestino:'Banco Ganadero'};
 for(const data of [null,'','ilegível','04/10/2026','2026-02-30','2026-13-01','2026-00-10','2026-10-00','2026-10-04T12:00:00Z']) {
  const r=review.receiptReview({...receipt,data},50,'2026-10-04');
  assert(r.alertas.some(a=>a.startsWith('Data')),String(data));
  const notice=review.receiptNotice({...receipt,data},null,r);
  assert(!notice.includes('✅ CONFERE'));assert.match(notice,/CONFERIR/);
 }
 assert.equal(review.receiptReview({...receipt,data:'2026-10-04'},50,'2026-10-04').alertas.length,0);
 assert.equal(review.receiptReview({...receipt,data:'2024-02-29'},50,'2024-02-29').alertas.length,0);
 assert(review.receiptReview({...receipt,data:'2026-10-03'},50,'2026-10-04').alertas.some(a=>a.startsWith('Data diferente')));
});

test('data inválida encaminha comprovante à equipe sem acionar registro de pagamento',async()=>{
 for(const data of ['ilegível','2026-13-01',rules.dayLaPaz()]) {
  const f=fixture();const o=await f.service.saveOrder(body());
  await f.service.inbound({telefone:phone,messageId:'receipt-date',momento:Date.now(),midia:'imagem',midiaUrl:'https://example.com/receipt.png'});
  const r=await f.service.ticket({telefone:phone,messageId:'receipt-date',geracao:2,mediaIds:['receipt-date'],tipo:'COMPROVANTE',pergunta:'Dados visíveis',cliente:'Cliente',comprovante:{tipo:'COMPROVANTE_BANCARIO',pedidoId:o.pedido.id,valor:65,moeda:'Bs',beneficiario:'Lazzarini Franca Matheus',bancoDestino:'Banco Ganadero',data}});
  assert.equal(r.registrado,true);assert.equal(r.notificacaoEnviada,true);
  const valid=data===rules.dayLaPaz();assert.equal(f.receiptPayments(),valid?1:0);
  assert.equal(f.state().agentTicket[0].question.includes('✅ CONFERE'),valid);
  if(!valid) assert.match(f.state().agentTicket[0].question,/Data inválida/);
 }
});
test('catálogo impede preço alterado e permite nova intenção explícita sem duplicar callback',async()=>{
 const f=fixture();await assert.rejects(f.service.saveOrder({...body(),pedido:{...order(),itens:[{variantId:'v-torta',descricao:'Torta',quantidade:1,precoUnitario:1}]}}),/Preço mudou/);
 await f.service.saveOrder(body());const b={...body(),messageId:'m2',pedido:{...order(),novoPedidoSeparado:true}};await f.service.saveOrder(b);await f.service.saveOrder(b);assert.equal(f.state().order.length,2);
});
test('rastreio mantém somente espanhol quando cliente escreveu espanhol anteriormente',async()=>{
 const f=fixture();f.state().agentInbox.push({phone,ready:true,messageId:'old',moment:BigInt(Date.now()-1000),content:'Hola, quiero recibir mañana'});
 const r=await f.service.ticket({telefone:phone,messageId:'m1',geracao:1,pergunta:'Pedido'});await f.service.team({grupo:'test',referenceMessageId:r.messageId,messageId:'team1',texto:'https://delivery.yango.com/route/#abc'});
 const msg=f.state().agentDelivery.at(-1).body.message;assert.match(msg,/Sigue tu entrega/);assert(!msg.includes('Acompanhe'));assert.match(msg,/instagram.com/);
});

test('terça permite entrega antecipada, mas bloqueia nova compra no mesmo dia e retirada',()=>{
 const now=new Date('2026-10-03T12:00:00Z');
 assert.equal(rules.orderInput({...order(),data:'2026-10-06',modalidade:'ENTREGA',horario:'14:00'},now).deliveryTime,'14:00');
 assert.throws(()=>rules.orderInput({...order(),data:'2026-10-06',modalidade:'RETIRADA'},now),/Terça-feira/);
 const tuesday=new Date('2026-10-06T12:00:00Z');
 const input={...order(),data:'2026-10-06',modalidade:'ENTREGA',horario:'15:00'};
 assert.throws(()=>rules.orderInput(input,tuesday),/nova compra/);
 assert.equal(rules.orderInput(input,tuesday,{deliveryDate:new Date('2026-10-06'),createdAt:new Date('2026-10-05T15:00:00Z'),deliveryTime:'15:00'}).deliveryTime,'15:00');
 assert.throws(()=>rules.orderInput(input,tuesday,{deliveryDate:new Date('2026-10-06'),createdAt:tuesday}),/nova compra/);
 assert.throws(()=>rules.orderInput(input,tuesday,{deliveryDate:new Date('2026-10-07'),createdAt:new Date('2026-10-05T15:00:00Z')}),/nova compra/);
 assert.throws(()=>rules.orderInput({...order(),data:'2026-10-05',horario:'10:00'},now),/Segunda-feira/);
 assert.equal(rules.orderInput({...order(),data:'2026-10-05',horario:'14:00'},now).deliveryTime,'14:00');
});
test('compra na terça pode ir para quarta, mas chantilly exige quinta e preserva encomenda anterior',()=>{
 const now=new Date('2026-10-06T16:00:00Z');
 const input={...order(),data:'2026-10-07',horario:'15:00'};
 assert.equal(rules.orderInput(input,now).deliveryTime,'15:00');
 assert.throws(()=>rules.orderInput({...input,cobertura:'Chantilly'},now),/dois dias/);
 assert.throws(()=>rules.orderInput({...input,itens:[{descricao:'Bolo chantilly',quantidade:1,precoUnitario:130}]},now),/dois dias/);
 assert.equal(rules.orderInput({...input,data:'2026-10-08',cobertura:'Chantilly'},now).deliveryTime,'15:00');
 assert.equal(rules.orderInput({...input,cobertura:'Chantilly'},now,{deliveryDate:new Date('2026-10-07'),createdAt:new Date('2026-10-04T15:00:00Z'),topping:'Chantilly'}).deliveryTime,'15:00');
 assert.throws(()=>rules.orderInput({...input,cobertura:'Chantilly'},now,{deliveryDate:new Date('2026-10-07'),createdAt:new Date('2026-10-04T15:00:00Z'),topping:'Chocolate'}),/dois dias/);
});
test('preparo depende de comando da equipe, não de imagem de comprovante',async()=>{
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'m1',geracao:1,pergunta:'Pedido'});
 const r=await f.service.team({grupo:'test',referenceMessageId:t.messageId,messageId:'team1',texto:'Preparando'});assert.equal(r.preparoConfirmado,true);assert(f.state().agentEvent.some(x=>x.kind==='PREPARING'));assert.match(f.state().agentDelivery.at(-1).body.message,/já está preparando/);
});
test('aviso legado precisa telefone validado da consulta Redis autenticada',async()=>{
 const f=fixture();await assert.rejects(f.service.team({grupo:'test',referenceMessageId:'old',messageId:'team1',texto:'Respondido',legadoTelefone:'inválido'}),/Telefone/);
 const r=await f.service.team({grupo:'test',referenceMessageId:'old',messageId:'team1',texto:'Respondido',legadoTelefone:phone});assert.equal(r.retomado,true);assert.equal(f.state().agentTicket[0].phone,phone);
});
test('classificação explícita de não comprovante impede inventar recibo',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'qr',midia:'imagem',momento:Date.now(),midiaUrl:'https://example.com/qr.png'});await f.service.operate({acao:'conteudo',telefone:phone,messageId:'qr',texto:'Tipo: OUTRA_IMAGEM. QR de cobrança, não comprovante.'});
 await assert.rejects(f.service.ticket({telefone:phone,messageId:'qr',geracao:2,mediaIds:['qr'],tipo:'COMPROVANTE',pergunta:'Inventado',comprovante:{tipo:'COMPROVANTE_BANCARIO'}}),/não é comprovante/);assert.equal(f.calls(),0);
});

 test('comprovante compatível fica informativo e não gera lembretes; divergência continua alertando',async()=>{
 const notices=load('notices');const question='📌 *Resumo*\n✅ CONFERE: comprovante de 105 Bs.\n\n👉 *Ação da equipe*\nConferir no banco (texto antigo)';
 const notice=notices.pendingNotice('COMPROVANTE','Ana',phone,question);
 assert(!notice.includes('VERIFICAR PAGAMENTO'));assert(!notice.includes('Conferir no banco'));assert(notice.includes('Pagamento compatível'));
 const f=fixture();f.state().agentTicket.push({id:'compatible',kind:'COMPROVANTE',question,status:'ABERTA',phone,customerName:'Ana',reminderCount:0,nextReminderAt:new Date(0)});
 await f.service.reminders();assert.equal(f.calls(),0);assert.equal(f.state().agentTicket[0].reminderCount,0);
 f.state().agentTicket[0].question='📌 *Resumo*\n⚠️ CONFERIR: valor divergente';
 await f.service.reminders();assert.equal(f.calls(),1);assert.equal(f.state().agentTicket[0].reminderCount,1);
 assert(notices.pendingNotice('COMPROVANTE','Ana',phone,'Valor ilegível').includes('VERIFICAR PAGAMENTO'));
 assert.equal(notices.compatibleReceipt('DUVIDA',question),false);
 });

test('registro da encomenda não duplica aviso do comprovante no grupo',async()=>{
 const f=fixture();const r=await f.service.saveOrder(body());
 assert.equal(f.state().order.length,1);assert.equal(f.calls(),0);assert.equal(f.state().agentTicket.length,0);assert.equal(r.notificacaoPrevista,'APOS_COMPROVANTE');
});

test('pedido imediato aparece como AGORA sem inventar hora; futuro e fora do atendimento são rejeitados',()=>{
 const now=new Date('2026-10-04T15:02:00Z');const b={...order(),data:'2026-10-04',horario:'',paraAgora:true};
 assert.equal(rules.orderInput(b,now).deliveryTime,'AGORA');
 assert.equal(rules.orderInput({...b,paraAgora:false},now).deliveryTime,null);
 assert.throws(()=>rules.orderInput({...b,data:'2026-10-05'},now),/agora/);
 assert.throws(()=>rules.orderInput(b,new Date('2026-10-04T13:00:00Z')),/agora/);
});

test('telefone boliviano legado recupera mesma encomenda sem mudar saldo, data ou status',async()=>{const f=fixture();const r=await f.service.saveOrder(body());const o=f.state().order[0];o.customerPhone=phone.slice(3);o.paid=65;const c=await f.service.context(phone);assert.equal(c.pedidos.length,1);assert.equal(c.pedidos[0].id,r.pedido.id);assert.equal(f.state().order.length,1);assert.equal(f.state().order[0].paid,65);assert.equal(f.state().order[0].customerPhone,phone);await f.service.context(phone);assert.equal(f.state().order.length,1);});
test('vínculo legado nunca presume país para número brasileiro',async()=>{const f=fixture();await f.service.saveOrder(body());f.state().order[0].customerPhone='73957478';const c=await f.service.context('5573957478');assert.equal(c.pedidos.length,0);assert.equal(f.state().order[0].customerPhone,'73957478');});

test('falha atual do QR abre pendência e não apresenta o mesmo arquivo como QR novo',async()=>{const f=fixture();const r=await f.service.saveOrder(body());f.state().agentEvent.push({key:'batch:complaint',phone,kind:'BATCH',createdAt:new Date(),result:{messageId:'qr-complaint',message:'Me sale QR inválido, en tres bancos no funciona'}});const before=f.calls();const q=await f.service.operate({acao:'qr',telefone:phone,messageId:'qr-complaint',geracao:1,pedidoId:r.pedido.id,idioma:'es'});assert.equal(q.motivo,'FALHA_QR_ENCAMINHADA');assert.equal(q.enviado,false);assert.equal(f.state().agentTicket.length,1);assert.equal(f.state().agentDelivery.filter(x=>x.key.startsWith('qr:')).length,0);assert.equal(f.calls(),before+1);});

test('promessa de agendamento sem registro vira solicitação pendente, nunca confirmação',async()=>{const f=fixture();await f.service.operate({acao:'enviar',telefone:phone,messageId:'promise',geracao:1,texto:'Te agendo la entrega para hoy a las 15:30',parte:'0'});const reply=f.state().agentDelivery.find(x=>x.key.startsWith('reply:'));assert.match(reply.body.message,/pendiente de confirmación/);assert.doesNotMatch(reply.body.message,/Te agendo/);assert.equal(f.state().agentTicket.length,1);assert.equal(f.state().order.length,0);});
test('agendamento efetivamente registrado pode ser confirmado no mesmo atendimento',async()=>{const f=fixture();await f.service.saveOrder(body());await f.service.operate({acao:'enviar',telefone:phone,messageId:'m1',geracao:1,texto:'Ficou agendado para as 17:00 😊',parte:'0'});assert.equal(f.state().agentTicket.length,0);assert.match(f.state().agentDelivery[0].body.message,/Ficou agendado/);});

test('envio remove negrito e travessões sem modificar links ou hífens',async()=>{
 const f=fixture();await f.transport.sendOnce('reply:plain',phone,'*Olá* — pronta – sim https://example.com/meu-link',undefined,1);
 assert.equal(f.state().agentDelivery[0].body.message,'Olá, pronta, sim https://example.com/meu-link');assert.equal(f.calls(),1);
});

test('pergunta da equipe sobre envio não encerra uma pendência',async()=>{
 for(const question of ['Foi enviado?','Sim, já foi enviado?']){
 const f=fixture();const t=await f.service.ticket({telefone:phone,messageId:'doubt-question',geracao:1,pergunta:'Entrega por Yango'});
 await f.service.team({grupo:'test',referenceMessageId:t.messageId,messageId:'staff-question',texto:question});assert.equal(f.state().agentTicket[0].status,'ASSUMIDA');assert.equal(f.receiptPayments(),0);
 }
});
test('mídia humana sem texto não esconde última resposta legível nem inventa conteúdo',()=>{
 const facts=load('conversation-context').conversationFacts([{papel:'atendente',origem:'humano',texto:'Já combinamos a entrega.',data:'2026-10-05T18:00:00Z'},{papel:'atendente',origem:'humano',texto:'',data:'2026-10-05T18:01:00Z'},{papel:'atendente',origem:'humano',texto:undefined,data:'2026-10-05T18:02:00Z'}]);assert.equal(facts.ultimaRespostaAnterior.texto,'Já combinamos a entrega.');
});


test('empadão M/G exige 1 hora de forno no mesmo dia e não aceita perto do fechamento',()=>{
 const pie={...order(),data:'2026-10-15',modalidade:'ENTREGA',itens:[{variantId:'v-emp',descricao:'Empadão de Frango M (750 g)',quantidade:1,precoUnitario:65}]};
 const thu1830=new Date('2026-10-15T22:30:00Z');// quinta 18:30 La Paz, fecha 21:00
 assert.equal(rules.orderInput({...pie,horario:'19:30'},thu1830).deliveryTime,'19:30');
 assert.throws(()=>rules.orderInput({...pie,horario:'19:00'},thu1830),/horário mínimo é 19:30/);
 assert.equal(rules.orderInput({...pie,horario:'AGORA',paraAgora:true},thu1830).deliveryTime,'AGORA');
 const thu2030=new Date('2026-10-16T00:30:00Z');// quinta 20:30 La Paz
 assert.throws(()=>rules.orderInput({...pie,horario:'AGORA',paraAgora:true},thu2030),/não fica pronto antes do fechamento/);
 assert.throws(()=>rules.orderInput({...pie,horario:'20:50'},thu2030),/não fica pronto antes do fechamento/);
 const grande={...pie,itens:[{variantId:'v-g',descricao:'Empadão G frango com requeijão',quantidade:1,precoUnitario:120}]};
 assert.throws(()=>rules.orderInput({...grande,horario:'20:50'},thu2030),/1 hora/);
 const pequeno={...pie,itens:[{variantId:'v-p',descricao:'Empadão P (250 g)',quantidade:1,precoUnitario:20}]};
 assert.equal(rules.orderInput({...pequeno,horario:'20:50'},thu2030).deliveryTime,'20:50');
 const empadinha={...pie,itens:[{variantId:'v-e',descricao:'Empadinha M',quantidade:10,precoUnitario:6.5}]};
 assert.equal(rules.orderInput({...empadinha,horario:'20:50'},thu2030).deliveryTime,'20:50');
 assert.equal(rules.orderInput({...pie,data:'2026-10-16',horario:'10:30'},thu2030).deliveryTime,'10:30');
});

test('horários de encomendas agendadas definidos pelos donos',()=>{
 const sat=new Date('2026-10-03T12:00:00Z');
 const at=(data,horario)=>rules.orderInput({...order(),data,modalidade:'ENTREGA',horario},sat).deliveryTime;
 // Terça 06/10: só 11:00, 14:00 ou 17:00
 for(const h of ['11:00','14:00','17:00'])assert.equal(at('2026-10-06',h),h);
 for(const h of ['10:00','14:30','19:00'])assert.throws(()=>at('2026-10-06',h),/11:00, 14:00 ou 17:00/);
 // Segunda 05/10: das 11:00 às 20:00
 assert.equal(at('2026-10-05','11:00'),'11:00');assert.equal(at('2026-10-05','20:00'),'20:00');assert.throws(()=>at('2026-10-05','10:30'),/Segunda-feira/);
 // Quarta 07/10: 10:00 ou 14:00-20:00
 assert.equal(at('2026-10-07','10:00'),'10:00');assert.equal(at('2026-10-07','15:00'),'15:00');assert.throws(()=>at('2026-10-07','11:00'),/Quarta-feira/);
 // Domingo 04/10 e quinta 08/10: 10:00-20:00
 assert.equal(at('2026-10-04','10:30'),'10:30');assert.equal(at('2026-10-08','20:00'),'20:00');assert.throws(()=>at('2026-10-08','20:30'),/10:00 às 20:00/);
 // Para hoje (sábado) continua valendo o horário de atendimento até 21:00
 assert.equal(at('2026-10-03','20:30'),'20:30');
});

test('Kit Mini Cumpleaños no mesmo dia só com 6 horas para imprimir as fotos',()=>{
 const kit={...order(),data:'2026-10-15',modalidade:'ENTREGA',itens:[{variantId:'kmc',descricao:'Kit Mini Cumpleaños Único',quantidade:1,precoUnitario:100}]};
 const thu10=new Date('2026-10-15T14:00:00Z');// quinta 10:00 La Paz
 assert.equal(rules.orderInput({...kit,horario:'16:00'},thu10).deliveryTime,'16:00');
 assert.throws(()=>rules.orderInput({...kit,horario:'15:00'},thu10),/horário mínimo é 16:00/);
 assert.throws(()=>rules.orderInput({...kit,horario:'AGORA',paraAgora:true},thu10),/6 horas/);
 const thu1530=new Date('2026-10-15T19:30:00Z');// quinta 15:30, pronto 21:30 > fecha 21:00
 assert.throws(()=>rules.orderInput({...kit,horario:'20:30'},thu1530),/não fica pronto hoje/);
 assert.equal(rules.orderInput({...kit,data:'2026-10-16',horario:'11:00'},thu1530).deliveryTime,'11:00');
});

test('comprovante entre o sinal e o saldo conta como pagamento parcial válido',()=>{
 const review=load('review',{'./rules':rules});const today=rules.dayLaPaz();
 const base={moeda:'Bs',beneficiario:'Lazzarini Franca Matheus',bancoDestino:'Banco Ganadero',data:today};
 assert.equal(review.receiptReview({...base,valor:100},80,today,160).alertas.length,0);
 assert.equal(review.receiptReview({...base,valor:160},80,today,160).alertas.length,0);
 assert.match(review.receiptReview({...base,valor:70},80,today,160).alertas.join(),/Valor diverge/);
 assert.match(review.receiptReview({...base,valor:170},80,today,160).alertas.join(),/Valor diverge/);
 assert.match(review.receiptReview({...base,valor:100},80,today).alertas.join(),/Valor diverge/);
});

test('QR is not resent for status requests; explicit resend remains available',async()=>{
 const f=fixture();const saved=await f.service.saveOrder(body());
 const q={acao:'qr',telefone:phone,messageId:'first',pedidoId:saved.pedido.id,geracao:1,arquivoUrl:'https://example.com/qr.png'};
 assert.equal((await f.service.operate(q)).enviado,true);const calls=f.calls();
 for(const [messageId,message] of [['status','?'],['late','Bro paso una hora, aún no?']]) {
  f.state().agentEvent=f.state().agentEvent.filter(e=>e.kind!=='BATCH');
  await f.prisma.agentEvent.create({data:{key:messageId,phone,kind:'BATCH',result:{messageId,message}}});
  assert.equal((await f.service.operate({...q,messageId})).motivo,'QR_JA_ENVIADO');
 }
 assert.equal(f.calls(),calls);
 f.state().agentEvent=f.state().agentEvent.filter(e=>e.kind!=='BATCH');
 await f.prisma.agentEvent.create({data:{key:'explicit',phone,kind:'BATCH',result:{messageId:'resend',message:'Me envia o QR de novo'}}});
 assert.equal((await f.service.operate({...q,messageId:'resend'})).enviado,true);assert.equal(f.calls(),calls+1);
});

test('unread PDF prevents another QR even when customer requests it',async()=>{
 const f=fixture();const saved=await f.service.saveOrder(body());
 const q={acao:'qr',telefone:phone,messageId:'first',pedidoId:saved.pedido.id,geracao:1,arquivoUrl:'https://example.com/qr.png'};
 await f.service.operate(q);const calls=f.calls();
 await f.prisma.agentInbox.create({data:{phone,messageId:'pdf',mediaKind:'pdf',content:'<TranscricaoPDF></TranscricaoPDF>'}});
 await f.prisma.agentEvent.create({data:{key:'explicit',phone,kind:'BATCH',result:{messageId:'resend',message:'Me envia o QR de novo'}}});
 assert.equal((await f.service.operate({...q,messageId:'resend'})).motivo,'COMPROVANTE_PENDENTE');assert.equal(f.calls(),calls);
});

test('PDF received in current batch never triggers first billing',async()=>{
 const f=fixture();const saved=await f.service.saveOrder(body());
 await f.prisma.agentEvent.create({data:{key:'pdf-batch',phone,kind:'BATCH',result:{messageId:'pdf',message:'<ContextoPDF><TranscricaoPDF></TranscricaoPDF></ContextoPDF>'}}});
 const calls=f.calls();const r=await f.service.operate({acao:'qr',telefone:phone,messageId:'pdf',pedidoId:saved.pedido.id,geracao:1});
 assert.equal(r.motivo,'COMPROVANTE_PENDENTE');assert.equal(f.calls(),calls);
});

test('HTTP retry resumes only an unprocessed current inbox without duplicating generation',async()=>{
 const f=fixture();const b={telefone:phone,messageId:'lost-response',momento:Date.now(),midia:'texto',texto:'Quero informações',recuperarPendente:true};
 assert.equal((await f.service.inbound(b)).ignorar,false);const generation=f.state().agentConversation[0].generation;
 assert.equal((await f.service.inbound(b)).ignorar,false);assert.equal(f.state().agentConversation[0].generation,generation);assert.equal(f.state().agentInbox.length,1);
 f.state().agentInbox[0].ready=true;assert.equal((await f.service.inbound(b)).ignorar,true);
 f.state().agentInbox[0].ready=false;f.state().agentConversation[0].pausedUntil=new Date(Date.now()+60000);assert.equal((await f.service.inbound(b)).ignorar,true);
 f.state().agentConversation[0].pausedUntil=null;f.state().agentConversation[0].latestMoment+=1n;assert.equal((await f.service.inbound(b)).ignorar,true);
});

test('retired variant cannot be registered even if active in source table',async()=>{
 const f=fixture();f.state().product[0].name='Combo Porção Prestígio';assert.equal((await f.service.catalog()).length,0);
 await assert.rejects(f.service.saveOrder(body()),/Item sem preço autorizado/);
});


test('comprovante consumido sobrevive à geração de Aquí está e não volta depois do pagamento',async()=>{
 const f=fixture();
 await f.service.inbound({telefone:phone,messageId:'receipt-carry',momento:Date.now(),midia:'imagem',midiaUrl:'https://example.com/receipt.png'});
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:'receipt-carry',texto:'Tipo: COMPROVANTE_BANCARIO\nValor: 200 Bs'});
 const first=await f.service.prepare({telefone:phone,execucao:'image-batch'});assert.equal(first.mediaIds[0],'receipt-carry');
 await f.service.inbound({telefone:phone,messageId:'here',momento:Date.now()+1,midia:'texto',texto:'Aquí está'});
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:'here',texto:'Aquí está'});
 const next=await f.service.prepare({telefone:phone,execucao:'text-batch'});assert.equal(next.messageId,'here');assert(next.mediaIds.includes('receipt-carry'));assert.match(next.message,/Valor: 200 Bs/);
 await f.prisma.agentEvent.create({data:{key:'payment-carry',phone,kind:'RECEIPT_PAYMENT',payload:{mediaId:'receipt-carry'}}});
 await f.service.inbound({telefone:phone,messageId:'thanks',momento:Date.now()+2,midia:'texto',texto:'Gracias'});
 await f.service.operate({acao:'conteudo',telefone:phone,messageId:'thanks',texto:'Gracias'});
 const last=await f.service.prepare({telefone:phone,execucao:'thanks-batch'});assert.equal(last.mediaIds.length,0);
});
test('falha comercial abre pendência durável e aviso antes da resposta sem falsa confirmação',async()=>{
 const f=fixture();const b={telefone:phone,messageId:'failed-order',geracao:1,acao:'enviar',parte:'0',texto:'Seu pedido foi registrado',idioma:'pt',falhasFerramentas:[{ferramenta:'registrar_encomenda'}]};
 await f.prisma.agentEvent.create({data:{key:`in:${phone}:failed-order`,phone,kind:'INBOUND',payload:{text:'Quero encomendar um bolo para amanhã'}}});
 await f.service.operate(b);await f.service.operate(b);
 assert.equal(f.state().agentTicket.length,1);assert.match(f.state().agentTicket[0].question,/encomendar um bolo/);
 assert.equal(f.state().agentDelivery.filter(d=>d.key.startsWith('ticket:')).length,1);
 assert.equal(f.state().order.length,0);
 const reply=f.state().agentDelivery.find(d=>d.key.startsWith('reply:'));assert.match(reply.body.message,/equipe confira/);assert.doesNotMatch(reply.body.message,/pedido foi registrado/);
});

test('salvar pedido idêntico novamente após comprovante não valida SKU inventado nem altera pagamento',async()=>{
 const f=fixture();const b=body();const saved=await f.service.saveOrder(b);const existing=f.state().order[0];existing.paid=130;
 const request={...b,messageId:'receipt-repeat',pedido:{...b.pedido,id:saved.pedido.id,versao:1,itens:b.pedido.itens.map(v=>({...v,variantId:'inventado-mas-sem-alteracao'}))}};
 const result=await f.service.saveOrder(request);assert.equal(result.registrado,true);assert.equal(result.semAlteracao,true);assert.equal(f.state().order.length,1);assert.equal(f.state().order[0].paid,130);assert.equal(f.state().order[0].agentVersion,1);
 request.messageId='receipt-changed';request.pedido.itens[0].quantidade=2;await assert.rejects(f.service.saveOrder(request),/Item sem preço/);assert.equal(f.state().order[0].paid,130);
});
test('envio valida preço atual de fatia antes de enviar e abre pendência sem cobrar valor incorreto',async()=>{
 const f=fixture();await f.prisma.product.create({data:{id:'fatia',name:'Fatia Maracujá',active:true,onStore:true,priceOnRequest:false,trackStock:true,variants:[{id:'mar',name:'Único',price:30,active:true,stock:7}]}});
 const r=await f.service.operate({acao:'enviar',telefone:phone,messageId:'wrong-price',geracao:1,parte:'0',texto:'1 porción de maracuyá con chocolate: 35 Bs',idioma:'es'});
 assert.equal(r.enviado,true);assert.equal(f.state().agentTicket.length,1);assert.match(f.state().agentTicket[0].question,/citado 35 Bs; painel atual 30 Bs/);
 const reply=f.state().agentDelivery.find(d=>d.key.startsWith('reply:'));assert.equal(reply.body.message,'Voy a confirmar esa información con el equipo.');assert.doesNotMatch(reply.body.message,/35 Bs|painel|divergia|FORA_CATALOGO/);assert.equal(f.state().order.length,0);
});
test('registro bloqueia quantidade sem estoque e preserva produtos sem controle de estoque',async()=>{
 const f=fixture();f.state().product[0].trackStock=true;f.state().product[0].variants[0].stock=1;
 const b=body();b.pedido.itens[0].quantidade=2;await assert.rejects(f.service.saveOrder(b),/Estoque insuficiente/);assert.equal(f.state().order.length,0);
 f.state().product[0].trackStock=false;assert.equal((await f.service.saveOrder(b)).registrado,true);
});
test('PDF ilegível registra uma única pendência sem pagamento nem confirmação de preparo',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'pdf',midia:'pdf',texto:'comprovante',momento:Date.now()});
 const b={acao:'falhaAnalise',telefone:phone,messageId:'pdf',geracao:2,etapa:'pdf',idioma:'pt'};
 await f.service.operate(b);await f.service.operate(b);assert.equal(f.state().agentTicket.length,1);assert.equal(f.state().order.length,0);assert.equal(f.receiptPayments(),0);assert.equal(f.calls(),1);
});

test('sending a Spanish pot synonym passes catalog validation and preserves customer text',async()=>{
 const f=fixture();Object.assign(f.state().product[0],{name:'Pote Ninho com Frutas Vermelhas'});f.state().product[0].variants[0].price=25;
 const texto='un cuchareable de ninho con frutas rojas: 25 Bs';
 const r=await f.service.operate({acao:'enviar',telefone:phone,messageId:'pot-alias',parte:'0',geracao:1,texto,idioma:'es'});
 assert.equal(r.enviado,true);assert.equal(f.state().agentTicket.length,0);assert.equal(f.state().agentDelivery.find(d=>d.phone===phone).body.message,texto);
});
test('blocked quote keeps diagnostics in team notice and sends only natural customer fallback',async()=>{
 for(const [name,texto] of [['Pote Ninho com Frutas Vermelhas','Cucharable Nido con frutas rojas: 20 Bs'],['Pote Ninho com Morango','Cucharable Nido con frutas rojas: 25 Bs']]) {
  const f=fixture();f.state().product[0].name=name;f.state().product[0].variants[0].price=25;
  await f.service.operate({acao:'enviar',telefone:phone,messageId:'blocked',parte:'0',geracao:1,texto,idioma:'es'});
  assert.equal(f.state().agentTicket.length,1);assert.match(f.state().agentTicket[0].question,/Preço na resposta divergia/);
  const customer=f.state().agentDelivery.filter(d=>d.phone===phone);assert.equal(customer.length,1);assert.equal(customer[0].body.message,'Voy a confirmar esa información con el equipo.');assert(!/FORA_CATALOGO|SEM_ESTOQUE|painel|catalog|diverg|resumen|conferencia/i.test(customer[0].body.message));
 }
});
