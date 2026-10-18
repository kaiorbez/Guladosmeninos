function shouldCompleteRegistration(a,current){
 if((a.intermediateSteps||[]).length||a.error||a.retentativaOperacao)return false;
 if((current.pedidos||[]).some(p=>p.situacao==='PENDENTE'))return false;
 const message=String(current.message||'').trim();
 if(!/^(?:s[ií]m*|si|claro|confirmo|confirmad[oa]|ok|perfeito|perfecto|qr(?: por favor)?|pode|pode ser)[.!\s😊👍]*$/iu.test(message))return false;
 return !/[?¿]/.test(String(a.output||'')) && /\bqr\b/iu.test(String(a.output||'')) && /env[ií]o|envi[ao]r|confirm/iu.test(String(a.output||''));
}
const completionGate=shouldCompleteRegistration.toString()+`\nconst a=$json;const current=$('Consultar Ficha do Cliente').first().json;return [{json:{...a,concluirRegistro:shouldCompleteRegistration(a,current)}}];`;
function patchCompletion(w){
 if(w.nodes.some(n=>n.name==='Concluir registro pendente'))throw Error('Completion patch already applied');
 const a=w.nodes.find(n=>n.name==='Agente Gula'),retry=JSON.parse(JSON.stringify(a));delete retry.id;
 retry.name='Concluir registro pendente';retry.position=[5248,2784];retry.retryOnFail=false;
 retry.parameters.text=a.parameters.text;
 retry.parameters.options.systemMessage=a.parameters.options.systemMessage+'\nCONCLUSÃO DE OPERAÇÃO OMITIDA: esta é UMA tentativa complementar porque a resposta anterior prometeu QR sem usar ferramentas. Não escreva outra promessa. Use a ficha e o histórico deste cliente para decidir: se dados/aceite forem suficientes, copie IDs e preços atuais, chame registrar_encomenda e somente após registrado=true chame enviar_qr_pagamento. Se faltar dado, pergunte apenas o faltante. Se o preço mudou ou o estoque é insuficiente, não registre nem cobre: explique o impedimento e peça novo aceite/alternativa. Nenhuma informação de outro cliente pode ser usada. Em falha de geração/pausa responda [SEM_RESPOSTA]. Não invente sucesso nem abra pendência por mera omissão anterior. Após QR enviado=true, [SEM_RESPOSTA].';
 w.nodes.push({name:'Verificar operação omitida',type:'n8n-nodes-base.code',typeVersion:2,position:[4832,2688],parameters:{jsCode:completionGate}}, {name:'Completar registro?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[5040,2688],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'complete-registration',leftValue:'={{ $json.concluirRegistro }}',rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}},retry);
 const edge=node=>({node,type:'main',index:0});
 const prior=w.connections[a.name].main;w.connections[a.name].main=[[edge('Verificar operação omitida')],...(prior.slice(1))];
 w.connections['Verificar operação omitida']={main:[[edge('Completar registro?')]]};w.connections['Completar registro?']={main:[[edge(retry.name)],[edge('Conferir Resposta e Resultados')]]};
 w.connections[retry.name]={main:[[edge('Conferir Resposta e Resultados')],...(prior.slice(1))]};
 for(const c of Object.values(w.connections))for(const k of ['ai_tool','ai_languageModel'])for(const output of c[k]||[])if(output.some(e=>e.node===a.name))output.push({node:retry.name,type:k,index:0});
 const guard=w.nodes.find(n=>n.name==='Conferir Resposta e Resultados');guard.parameters.jsCode=guard.parameters.jsCode.replace("const a=$('Agente Gula').first().json;","const a=$json;");
 return w;
}
module.exports={shouldCompleteRegistration,patchCompletion};
