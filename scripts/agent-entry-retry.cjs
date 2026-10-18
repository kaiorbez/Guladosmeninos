function patchEntryRetries(workflow) {
 const node=workflow.nodes.find(n=>n.name==='Registrar Entrada Painel');
 if(!node || typeof node.parameters?.jsonBody!=='string')throw Error('Entry node missing');
 if(!node.parameters.jsonBody.includes('recuperarPendente:true')) {
  if(!node.parameters.jsonBody.includes("acao:'entrada',"))throw Error('Entry body changed');
  node.parameters.jsonBody=node.parameters.jsonBody.replace("acao:'entrada',","acao:'entrada',recuperarPendente:true,");
 }
 node.retryOnFail=true;node.maxTries=5;node.waitBetweenTries=5000;
 return workflow;
}
module.exports={patchEntryRetries};
