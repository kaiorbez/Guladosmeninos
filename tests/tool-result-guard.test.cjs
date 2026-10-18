const { test } = require('node:test'), assert = require('node:assert/strict');
const { failedCommercialTools } = require('../scripts/tool-result-guard.cjs');
const step = (tool, result, tipo = 'COMPROVANTE') => ({ action: { tool, toolInput: { tipo } }, observation: JSON.stringify([result]) });
test('recibo de 200 Bs sem mídia no novo lote não vira promessa silenciosa de conferência', () => {
  const failures = failedCommercialTools([step('avisar_equipe', { ok: false, error: 'Sem imagem/PDF recebido neste lote.' })], 'Recebi o comprovante de 200 Bs e vou conferir e já te confirmo');
  assert.equal(failures.length, 1); assert.equal(failures[0].ferramenta, 'avisar_equipe');
});
test('registro de pedido malsucedido exige pendência; registro e aviso confirmados não duplicam', () => {
  assert.equal(failedCommercialTools([step('registrar_encomenda', { ok: false })], 'Pedido registrado').length, 1);
  assert.equal(failedCommercialTools([step('registrar_encomenda', { ok: true, registrado: true }), step('avisar_equipe', { ok: true, registrado: true, notificacaoEnviada: true })], 'Recibí el comprobante').length, 0);
});
test('aviso sem confirmação de envio e recibo sem ferramenta são sinalizados', () => {
  assert.equal(failedCommercialTools([step('avisar_equipe', { ok: true, registrado: true, notificacaoEnviada: false })], '').length, 1);
  assert.equal(failedCommercialTools([], 'Recebi o comprovante').length, 1);
  assert.equal(failedCommercialTools([], '¿Qué sabor prefieres?').length, 0);
});

test('registro sem ferramenta é bloqueado; negação e condição não viram falha',()=>{assert.equal(failedCommercialTools([], 'Seu pedido foi registrado').length,1);assert.equal(failedCommercialTools([], 'Ainda não registrei seu pedido').length,0);assert.equal(failedCommercialTools([], 'Quando registrar seu pedido, envio o QR').length,0);});

test('erro de preço corrigido e pedido salvo na mesma execução não gera aviso falso',()=>{
 const attempts=[step('registrar_encomenda',{ok:false,error:'Preço não autorizado'}),step('registrar_encomenda',{ok:true,registrado:true})];
 assert.equal(failedCommercialTools(attempts,'[SEM_RESPOSTA]').length,0);
 assert.equal(failedCommercialTools(attempts,'Pedido registrado').length,0);
 attempts.push(step('registrar_encomenda',{ok:false,error:'Conflito posterior'}));
 assert.equal(failedCommercialTools(attempts,'Pedido registrado').length,1);
});
test('aviso confirmado depois de tentativa falha resolve somente o mesmo tipo de operação',()=>{
 const attempts=[step('avisar_equipe',{ok:false}),step('avisar_equipe',{ok:true,registrado:true,notificacaoEnviada:true})];
 assert.equal(failedCommercialTools(attempts,'').length,0);
 const other={action:{tool:'avisar_equipe',toolInput:{tipo:'DUVIDA'}},observation:JSON.stringify({ok:true,registrado:true,notificacaoEnviada:true})};
 assert.equal(failedCommercialTools([step('avisar_equipe',{ok:false}),other],'').length,1);
});

test('saudação de acompanhamento pode afirmar pedido já existente sem gravar de novo',()=>{
 const current={message:'holaaa?',pedidos:[{id:'order192',situacao:'PENDENTE'}]};
 assert.equal(failedCommercialTools([],'Tu pedido está registrado y pendiente de revisión',current).length,0);
 assert.equal(failedCommercialTools([],'Tu pedido está registrado',{...current,pedidos:[]}).length,1);
 assert.equal(failedCommercialTools([],'Pedido registrado',{...current,message:'Quero mais quatro potes'}).length,1);
 assert.equal(failedCommercialTools([step('registrar_encomenda',{ok:false})],'Pedido registrado',current).length,1);
});

test('promessa de QR sem ficha registrada não substitui a ferramenta de registro',()=>{
 assert.equal(failedCommercialTools([],'Te envío el QR para pagar los 90 Bs.',{pedidos:[]}).length,1);
 assert.equal(failedCommercialTools([],'Posso te enviar o QR?',{pedidos:[]}).length,0);
 assert.equal(failedCommercialTools([step('registrar_encomenda',{ok:true,registrado:true})],'Te envío el QR',{pedidos:[]}).length,0);
});
