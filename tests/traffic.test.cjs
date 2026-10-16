const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const path=require('node:path');
const src=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/agent/traffic.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exp={};vm.runInNewContext(src,{exports:exp,require:m=>m==='@/lib/db'?{prisma:{}}:{dayLaPaz:()=>'2026-10-16'}});
test('reconhece a mensagem automática do anúncio em espanhol e português',()=>{
 for(const t of ['¡Hola! Quiero más información','Hola quiero mas informacion','¡Hola! Quiero más información sobre tortas','Olá! Tenho interesse e queria mais informações','Ola, quero mais informações'])assert.equal(exp.isAdGreeting(t),true,t);
 for(const t of ['Hola','Quiero una torta','Tem bolo pronto?',''])assert.equal(exp.isAdGreeting(t),false,t);
});
