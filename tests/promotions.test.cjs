const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/agent/promotions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out});
test('promoção de três potes abre e encerra nas datas locais, sem repetir na semana seguinte',()=>{
 for(const [instant,expected] of [['2026-10-09T03:59:59Z',false],['2026-10-09T04:00:00Z',true],['2026-10-12T03:59:59Z',true],['2026-10-12T04:00:00Z',false],['2026-10-16T16:00:00Z',false]]) assert.equal(out.promotionAvailable(out.POTS_PROMO,new Date(instant)),expected,instant);
 assert.equal(out.promotionAvailable('Combo Fatia',new Date('2026-10-12T04:00:00Z')),true);
});

test('duas fatias promocionais só ficam disponíveis em 17 e 18 de outubro no fuso local',()=>{
 for(const [instant,expected] of [['2026-10-17T03:59:59Z',false],['2026-10-17T04:00:00Z',true],['2026-10-19T03:59:59Z',true],['2026-10-19T04:00:00Z',false],['2026-10-24T16:00:00Z',false]]) assert.equal(out.promotionAvailable(out.SLICES_PROMO,new Date(instant)),expected,instant);
 assert.equal(out.promotionAvailable(out.POTS_PROMO,new Date('2026-10-17T16:00:00Z')),false);
 assert.equal(out.promotionAvailable('Combo Fatia',new Date('2026-10-19T04:00:00Z')),true);
});
