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
 const exports={};vm.runInNewContext(out,{exports,Date,URL,Set,Map,BigInt,JSON,Number,String,Array,Math,AbortSignal,process,console,fetch:mocks.fetch,require:n=>mocks[n]||require(n)});return exports;
}
const rules=load('rules');
const today=new Date().toISOString().slice(0,10);
const future=(()=>{const d=new Date(Date.now()+7*86400000);if(d.getUTCDay()===2)d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);})();
function matches(o,w={}) {return Object.entries(w).every(([k,v])=>{
 if(k==='NOT')return !matches(o,v);
 const x=o[k];if(v&&typeof v==='object'&&!(v instanceof Date)&&!Array.isArray(v)) {
 if('startsWith' in v)return typeof x==='string'&&x.startsWith(v.startsWith);
 if('in' in v)return v.in.includes(x);if('lt'in v)return x<v.lt;if('lte'in v)return x<=v.lte;
 }
 if(v instanceof Date)return +x===+v;return x===v;
});}
function fixture({network='ok'}={}) {
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
 const service=load('service',{'@/lib/db':{prisma},'./rules':rules,'./review':load('review',{'./rules':rules}),'./notices':load('notices'),'./transport':transport,'./history':{importHistory:async()=>{}}});
 return {prisma,service,transport,state:()=>state,calls:()=>calls,failWrite:()=>{failWrite=true;}};
}
const order=()=>({cliente:'Cliente',data:future,horario:'17:00',modalidade:'ENTREGA',endereco:'Torre, 13D',itens:[{variantId:'v-torta',descricao:'Torta maracujá P',quantidade:1,precoUnitario:130}]});
const body=()=>({telefone:phone,messageId:'m1',geracao:1,pedido:order()});
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
 const d=f.state().agentDelivery.find(d=>d.key==='ticket:'+r.ticketId);assert.match(d.body.message,/GULA — AVISO DO AGENTE/);assert.match(d.body.message,/✅ CONFERE/);assert.match(d.body.message,/Pagar ahora: 65 Bs/);assert.equal(f.state().order[0].paid,0);
 assert(f.state().agentDelivery.some(d=>d.body.media==='receipt-image'));
});
test('comprovante sem original disponível sinaliza falha de mídia, não sucesso',async()=>{
 const f=fixture();await f.service.inbound({telefone:phone,messageId:'r',midia:'pdf',momento:Date.now()});
 const r=await f.service.ticket({telefone:phone,messageId:'r',geracao:2,mediaIds:['r'],tipo:'COMPROVANTE',pergunta:'Dados',comprovante:{tipo:'COMPROVANTE_BANCARIO'}});assert.equal(r.midiaEnviada,false);
});
test('valor divergente e destinatário errado nunca geram CONFERE',()=>{
 const review=load('review',{'./rules':rules});const r=review.receiptReview({valor:10,moeda:'Bs',beneficiario:'Outra pessoa',bancoDestino:'Outro banco',data:today},20,today);
 assert(r.alertas.length>=3);assert.equal(r.pagamentoConfirmado,false);
 const msg=review.receiptNotice({valor:10,moeda:'Bs'},null,r);assert(!msg.includes('✅ CONFERE'));assert.match(msg,/Pedido não identificado/);
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

test('terça e horários fora da janela são bloqueados sem impedir encomenda futura válida',()=>{
 const now=new Date('2026-10-03T12:00:00Z');
 assert.throws(()=>rules.orderInput({...order(),data:'2026-10-06'},now),/Terça-feira/);
 assert.throws(()=>rules.orderInput({...order(),data:'2026-10-05',horario:'10:00'},now),/fora do atendimento/);
 assert.equal(rules.orderInput({...order(),data:'2026-10-05',horario:'14:00'},now).deliveryTime,'14:00');
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
 assert(!notice.includes('VERIFICAR PAGAMENTO'));assert(!notice.includes('Conferir no banco'));assert(notice.includes('programação de preparo'));
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
