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
