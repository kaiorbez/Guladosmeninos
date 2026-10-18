const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const exportsCarry = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/agent/receipt-carry.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsCarry, Date, Set });
const { unsettledReceiptMedia } = exportsCarry;
const now = new Date('2026-10-18T16:18:00Z'), phone = '59170000000';
const receipt = extra => ({ phone, messageId: 'receipt', mediaKind: 'imagem', ready: true, content: 'Tipo: COMPROVANTE_BANCARIO\nValor: 200 Bs', createdAt: new Date('2026-10-18T16:17:00Z'), ...extra });
const inbound = extra => ({ key: `in:${phone}:receipt`, phone, kind: 'INBOUND', payload: { fromMe: false, media: 'imagem', sourceUrl: 'https://example.com/receipt.png' }, ...extra });
test('recibo analisado continua vinculado quando Aqui está chega em outro lote', () => {
  const result = unsettledReceiptMedia(phone, [receipt({ consumedAt: new Date() })], [inbound()], now);
  assert.equal(result.length, 1); assert.equal(result[0].messageId, 'receipt');
});
test('não reaproveita recibo pago, antigo, não analisado, outro cliente ou foto de produto', () => {
  const paid = { key: 'paid', phone, kind: 'RECEIPT_PAYMENT', payload: { mediaId: 'receipt' } };
  assert.equal(unsettledReceiptMedia(phone, [receipt()], [inbound(), paid], now).length, 0);
  for (const extra of [{ createdAt: new Date('2026-10-18T15:00:00Z') }, { ready: false }, { phone: '59171111111' }, { content: 'Tipo: OUTRA_IMAGEM' }, { content: 'Tipo: REFERENCIA_BOLO' }]) assert.equal(unsettledReceiptMedia(phone, [receipt(extra)], [inbound()], now).length, 0);
});
test('exige evento real do cliente; histórico, texto, imagem enviada pela loja e URL ausente não bastam', () => {
  for (const events of [[], [inbound({ kind: 'HISTORY' })], [inbound({ payload: { fromMe: true, media: 'imagem', sourceUrl: 'https://example.com/a.png' } })], [inbound({ payload: { fromMe: false, media: 'texto', sourceUrl: 'https://example.com/a.png' } })], [inbound({ payload: { fromMe: false, media: 'imagem' } })]]) assert.equal(unsettledReceiptMedia(phone, [receipt()], events, now).length, 0);
});
