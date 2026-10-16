const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../lib/agent/growth.ts'),'utf8').replace(/^import .*$/mg,'');
const ex={};vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:ex,process:{env:{WHATSAPP_EQUIPE:'grupo'}},dayLaPaz:()=>'2026-10-16',Date,Math,Number,String,Set});
const now=new Date('2026-10-16T20:00:00Z');// quinta 16:00 La Paz
const h=n=>new Date(now.getTime()-n*3600000);
const base={phone:'59170000000',lastCustomerAt:h(4),lastReplyAt:h(3.9),lastReply:'O Kit Fiesta P custa 160 Bs. Para qual dia você precisa?',humanAfterCustomer:false,recentOrder:false,openTicket:false,paused:false,followUpLastWeek:false};
test('lembrete só para quem recebeu preço e sumiu entre 3 e 20 h',()=>{
 assert.equal(ex.followUpDecision(base,now),null);
 assert.match(ex.followUpDecision({...base,lastCustomerAt:h(2),lastReplyAt:h(1.9)},now),/menos de 3 h/);
 assert.match(ex.followUpDecision({...base,lastCustomerAt:h(22),lastReplyAt:h(21.9)},now),/janela/);
 assert.match(ex.followUpDecision({...base,lastReplyAt:h(5)},now),/última mensagem é do cliente/);
 assert.match(ex.followUpDecision({...base,lastReply:'Qual sabor você prefere?'},now),/preço/);
 assert.match(ex.followUpDecision({...base,lastReply:'Seu pedido já está sendo preparado! Total 160 Bs'},now),/preço/);
});
test('não manda lembrete com pedido, pendência, pausa, equipe ou lembrete recente',()=>{
 for(const k of ['recentOrder','openTicket','paused','humanAfterCustomer','followUpLastWeek']) assert.notEqual(ex.followUpDecision({...base,[k]:true},now),null,k);
 assert.equal(ex.followUpDecision({...base,phone:'grupo'},now),'contato interno');
 assert.equal(ex.followUpDecision({...base,phone:'59175678921'},now),'contato interno');
});
test('idioma do lembrete segue a última resposta e horário respeita a loja',()=>{
 assert.match(ex.followUpText('El Kit Fiesta P cuesta 160 Bs. ¿Para qué fecha?'),/^¡Hola!/);
 assert.match(ex.followUpText('O Kit Fiesta P custa 160 Bs.'),/^Oi!/);
 assert.equal(ex.storeOpen(new Date('2026-10-16T20:00:00Z')),true);   // quinta 16:00
 assert.equal(ex.storeOpen(new Date('2026-10-20T20:00:00Z')),false);  // terça
 assert.equal(ex.storeOpen(new Date('2026-10-17T00:45:00Z')),false);  // sexta 20:45, últimos 30 min
 assert.equal(ex.storeOpen(new Date('2026-10-19T15:00:00Z')),false);  // segunda 11:00, antes de abrir
});
test('resumo diário legível para a equipe',()=>{
 const t=ex.summaryText({day:'2026-10-16',customers:42,aiOrders:5,aiTotal:830,paidOrders:3,followUps:4,followUpOrders:1,takeovers:2,openTickets:3,newTickets:6});
 assert.match(t,/Resumo do dia 16\/10/);assert.match(t,/Clientes atendidos: 42/);assert.match(t,/Encomendas registradas pela IA: 5 \(Bs 830\)/);assert.match(t,/viraram pedido: 1/);
 assert.doesNotMatch(ex.summaryText({day:'2026-10-16',customers:0,aiOrders:0,aiTotal:0,paidOrders:0,followUps:0,followUpOrders:0,takeovers:0,openTickets:0,newTickets:0}),/\(Bs/);
});
