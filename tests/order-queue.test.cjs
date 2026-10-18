const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const exportsQueue = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/order-queue.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsQueue, Date });
const { compareOrderQueue, groupOrderQueue } = exportsQueue;
const stamp = time => new Date(`2026-10-18T${time}:00-04:00`);
const order = (id, deliveryTime, payment = '10:00', extra = {}) => ({ id, number: Number(id) || 1, deliveryTime, deliveryDate: new Date('2026-10-18T00:00:00Z'), createdAt: stamp('09:00'), paid: payment ? 50 : 0, payments: payment ? [{ amount: '50.00', paidAt: stamp(payment) }] : [], ...extra });
test('agora usa pagamento mais antigo, depois agendados por horário e horário ausente por último', () => {
  const orders = [order('1', '15:00', '09:05'), order('2', null, '09:01'), order('3', 'AGORA', '10:10'), order('4', 'AGORA', '10:00'), order('5', '11:00', '10:20'), order('6', 'AGORA', null)];
  assert.deepEqual(orders.sort(compareOrderQueue).map(o => o.id), ['4', '3', '6', '5', '1', '2']);
});
test('ordenação acontece antes do corte da página: agora pago nunca fica atrás de 30 agendados', () => {
  const rows = Array.from({ length: 35 }, (_, i) => order(String(i + 1), '10:00'));
  rows.push(order('99', 'AGORA', '10:30'));
  assert.equal(rows.sort(compareOrderQueue).slice(0, 30)[0].id, '99');
});
test('pagamento parcial mantém a vez do primeiro pagamento positivo, com fallback para legado pago', () => {
  const first = order('1', 'AGORA', '11:00', { paid: '100', payments: [{ amount: '-5', paidAt: stamp('08:00') }, { amount: 50, paidAt: stamp('10:10') }, { amount: 50, paidAt: stamp('11:00') }] });
  const second = order('2', 'AGORA', '10:20');
  const legacy = order('3', 'AGORA', null, { paid: '50', createdAt: stamp('10:15') });
  assert.deepEqual([second, legacy, first].sort(compareOrderQueue).map(o => o.id), ['1', '3', '2']);
});
test('dias e desempates são estáveis; grupos não alteram históricos ou horários desconhecidos', () => {
  const tomorrow = order('1', 'AGORA', '09:00', { deliveryDate: new Date('2026-10-19T00:00:00Z') });
  const today = order('2', '20:00');
  assert.equal([tomorrow, today].sort(compareOrderQueue)[0].id, '2');
  assert.equal(compareOrderQueue(order('1', 'AGORA'), order('1', 'AGORA')), 0);
  const rows = [order('1', 'AGORA'), order('2', '14:00'), order('3', '99:00')];
  assert.deepEqual(Array.from(groupOrderQueue(rows, true), g => g.key), ['agora', 'agendados', 'sem-horario']);
  assert.equal(groupOrderQueue(rows, false)[0].orders, rows);
});
