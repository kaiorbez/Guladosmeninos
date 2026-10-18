const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/agent/prompt-context.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,Date});
const format=exportsObject.formatAgentContext;
const item=(id,size)=>({variantId:id,produto:'Bolo',tamanho:size,descricao:'Sabores e ingredientes completos, sem promessa de disponibilidade.',preco:130,estoque:0,controlaEstoque:true,precoSobConsulta:false});
function payload(text){return JSON.parse(text.slice(text.lastIndexOf('\n')+1));}
test('catálogo compacto conserva cada ID, preço, estoque e descrição, além de histórico e pedidos',()=>{
 const context={message:'Quero o mesmo pedido de ontem',historico:[{papel:'cliente',texto:'Minha localização: https://maps.google.com/?q=1,2',data:'2026-10-03'}],pedidos:[{id:'antigo',total:260,pagoConfirmado:130,saldo:130}],catalogo:[item('p','P'),item('g','G'),{...item('custom','GG'),precoSobConsulta:true,descricao:'Preço sob consulta'}],geracao:8};
 const result=payload(format(context));const restored=result.catalogo.grupos.flatMap(g=>g.variantes.map(row=>{const {colunas,variantes,...common}=g;return {...common,...Object.fromEntries(colunas.map((key,i)=>[key,row[i]]))};}));
 assert.deepEqual(restored,context.catalogo);assert.deepEqual(result.historico,context.historico);assert.deepEqual(result.pedidos,context.pedidos);assert.equal(result.geracao,8);assert.equal(result.message,undefined);assert(format(context).startsWith('MENSAGEM ATUAL:\n'+context.message));
});

test('contexto sob consulta preserva mensagens, pedidos, saldos, pendências, geração e dados desconhecidos',()=>{
 const history=Array.from({length:100},(_,i)=>({papel:i%2?'atendente':'cliente',origem:i%2?'humano':'cliente',data:'2026-10-04T12:00:'+String(i),texto:'Mensagem '+i+' https://maps.google.com/?q=1,2'}));
 const context={message:'Meu pedido já está pago?',historico:history,pedidos:[{id:'antigo',pagoConfirmado:130,saldo:0,versao:5}],pendencias:[{id:'p',status:'ASSUMIDA'}],geracao:8,mediaIds:['recibo'],contextoConversa:{localizacaoRecebida:'https://maps.google.com/?q=1,2'},catalogo:Array.from({length:183},(_,i)=>item('v'+i,String(i))),novoCampo:{naoPerder:true}};
 const packed=payload(exportsObject.formatLeanAgentContext(context));
 const restored=packed.historico.mensagens.map(row=>Object.fromEntries(packed.historico.colunas.map((k,i)=>[k,row[i]])));
 assert.deepEqual(restored,history);assert.deepEqual(packed.pedidos,context.pedidos);assert.deepEqual(packed.pendencias,context.pendencias);assert.deepEqual(packed.contextoConversa,context.contextoConversa);assert.equal(packed.geracao,8);assert.deepEqual(packed.mediaIds,['recibo']);assert.deepEqual(packed.novoCampo,context.novoCampo);
 assert.equal(packed.catalogo,undefined);assert.equal(packed.catalogoDisponivelPorFerramenta,true);assert(exportsObject.formatLeanAgentContext(context).length<format(context).length);
 const extra=[{papel:'cliente',texto:'novo',anexo:'preservar'}];assert.deepEqual(payload(exportsObject.formatLeanAgentContext({historico:extra})).historico,extra);
});

test('relógio separado das regras respeita fechamento, fuso e exceção de entregas antecipadas na terça',()=>{
 const clock=exportsObject.agentBusinessHours;
 assert.equal(clock(Date.parse('2026-10-05T17:59:00Z')).atendimentoWhatsappAberto,false);
 assert.equal(clock(Date.parse('2026-10-05T18:00:00Z')).atendimentoWhatsappAberto,true);
 assert.equal(clock(Date.parse('2026-10-06T00:00:00Z')).atendimentoWhatsappAberto,false);
 const tuesday=clock(Date.parse('2026-10-06T16:00:00Z'));assert.equal(tuesday.tercaSemNovasComprasParaHoje,true);assert.equal(tuesday.proximaAberturaWhatsapp,'2026-10-07 14:00');assert.match(tuesday.horarioDeHoje,/antecipadas/);
 assert.equal(clock(Date.parse('2026-10-04T14:00:00Z')).atendimentoWhatsappAberto,true);
});
test('novos campos de catálogo são preservados pelo formato original',()=>{
 const context={message:'Hola',catalogo:[{...item('p','P'),restricao:'contém leite'}]};
 assert.deepEqual(payload(format(context)).catalogo,context.catalogo);
 assert.deepEqual(payload(format({message:'Hola',catalogo:[]})).catalogo.grupos,[]);
});
test('repetição de descrições é reduzida sem truncar conversa ou catálogo',()=>{
 const context={message:'Hola',catalogo:Array.from({length:100},(_,i)=>item('v'+i,String(i))),historico:Array.from({length:100},(_,i)=>({papel:'cliente',texto:'Mensagem '+i,data:String(i)}))};
 assert(format(context).length<JSON.stringify(context).length*0.7);assert.equal(payload(format(context)).historico.length,100);assert.equal(payload(format(context)).catalogo.grupos[0].variantes.length,100);
});

test('relógio oficial distingue 18:59 local de 22:59 UTC e não oferece próxima abertura enquanto aberto',()=>{
 const clock=exportsObject.agentBusinessHours(Date.parse('2026-10-05T22:59:08Z'));
 assert.equal(clock.agora,'2026-10-05 18:59');assert.equal(clock.atendimentoWhatsappAberto,true);assert.equal(clock.proximaAberturaWhatsapp,null);
 const text=exportsObject.formatLeanAgentContext({estadoAtendimento:clock,message:'pago por qr pfv',historico:[{papel:'cliente',texto:'sim',data:'2026-10-05T22:59:03Z'}]});
 assert.match(text,/18:59.*UTC-4/);assert.match(text,/ABERTO AGORA/);assert.match(text,/histórico com Z estão em UTC/);assert.equal(payload(text).historico.mensagens[0][2],'2026-10-05T22:59:03Z');
});


test('preço atual do painel aparece no contexto e prevalece sobre valor antigo da conversa',()=>{
 const item={variantId:'mar-real',produto:'Fatia Maracujá',tamanho:'Único',preco:30,estoque:7,precoSobConsulta:false};
 const context={message:'Aquí falta la porción de maracuyá',catalogo:[item,{...item,variantId:'outro',produto:'Torta inteira'}],historico:[{papel:'atendente',texto:'Porción de maracuyá 35 Bs'}]};
 const out=payload(exportsObject.formatLeanAgentContext(context));
 assert.equal(out.precosAtuaisDoPainel.itens.length,1);assert.equal(out.precosAtuaisDoPainel.itens[0][3],30);assert.equal(out.precosAtuaisDoPainel.itens[0][0],'mar-real');
 assert.match(out.precosAtuaisDoPainel.fonte,/prevalecem/);assert.equal(out.catalogo,undefined);
});
