const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const policy = `TERÇA-FEIRA E BOLOS COM CHANTILLY — ORIENTAÇÃO ATUAL DO DONO
Encomendas feitas com antecedência PODEM ser entregues na terça-feira, inclusive via WhatsApp/Yango. Não cancele, não mude a data e não encaminhe ao PedidosYa uma encomenda anterior só porque a entrega é terça. Consulte o pedido e o histórico; acompanhamento não é nova venda.
O bloqueio é para NOVA COMPRA feita na própria terça com entrega naquele mesmo dia pelo WhatsApp. Nesse caso ofereça outra data, começando por quarta se o produto permitir, ou PedidosYa para compra imediata, sem garantir que a plataforma esteja disponível. Cliente que compra antes da terça pode solicitar entrega na terça, respeitando antecedência, disponibilidade e confirmação da equipe.
Na terça pode receber pelo WhatsApp encomendas para quarta ou outros dias, mas BOLO COM CHANTILLY exige DOIS DIAS de antecedência. Compra na terça: ofereça quinta-feira ou depois, nunca quarta para chantilly. Para outros produtos, quarta pode ser oferecida conforme prazo e disponibilidade. Pergunte cobertura somente se necessário. Não transforme chantilly em outro produto nem mude data/cobertura sem aceite.
Terça permanece sem atendimento presencial. Há entregas de encomendas antecipadas em duas janelas, mas os horários exatos NÃO foram informados. Para entrega na terça, o estado atendimentoWhatsappAberto=false e a próxima abertura calculada NÃO cancelam as entregas antecipadas nem obrigam reagendar para quarta. Preserve horário já combinado; para nova encomenda antecipada, registre apenas o horário solicitado pendente de confirmação pela equipe. Não invente as duas janelas, não prometa chegada imediata e não aplique a janela de outro dia à terça.
Encomenda antiga registrada mantém a data e o acordo: não reaplique prazo de nova compra só porque o cliente voltou para acompanhar ou pagar. Não duplique vendas, pagamentos ou avisos. Preserve registro antes de confirmação, regras financeiras, idioma, texto sem negrito e todas as demais proteções.`;

function updatePrompt(prompt) {
  if(prompt.includes(policy)) return prompt;
  assert(prompt.includes('REGRAS DE ENTREGA NA TERÇA-FEIRA'), 'Expected Tuesday policy block');
  let result = prompt.replace(/REGRAS DE ENTREGA NA TERÇA-FEIRA[^\n]*\n[\s\S]*?(?=\nVocê atende os clientes)/, '');
  result = result.split('\n').map(line => {
    if (line.startsWith('- Terça:')) return '- Terça: sem atendimento presencial. Entregas de encomendas antecipadas são permitidas; novas compras para o próprio dia pelo WhatsApp são bloqueadas. Horários das duas janelas de entrega dependem da equipe.';
    if (line.startsWith('Na terça, para entrega da própria terça,')) return 'Na terça, diferencie nova compra para hoje de encomenda anterior: preserve a entrega já combinada; para nova compra para o mesmo dia ofereça outra data ou PedidosYa. Para outros dias, prossiga pelo WhatsApp respeitando o prazo de chantilly.';
    if (line.includes('terça-feira somente pelo PedidosYa')) return line.replace('terça-feira somente pelo PedidosYa, conforme as regras prioritárias.', 'terça permite entrega de encomendas antecipadas, conforme a política atual.');
    if (line.includes('Terça recebe pelo WhatsApp encomendas para outros dias; entrega no dia via PedidosYa.')) return line.replace('Terça recebe pelo WhatsApp encomendas para outros dias; entrega no dia via PedidosYa.', 'Terça permite entregas antecipadas; novas compras para o mesmo dia pelo WhatsApp são bloqueadas. Chantilly exige dois dias de antecedência.');
    return line.replace('tercaSomentePedidosYa:', 'tercaSemNovasComprasParaHoje:').replace("'Terça: entregas somente pelo PedidosYa'", "'Terça: encomendas antecipadas com entrega a confirmar; sem atendimento presencial'");
  }).join('\n');
  const newline = result.indexOf('\n');
  result = result.slice(0,newline+1) + policy + '\n\n' + result.slice(newline+1);
  assert(!result.includes('entregas da própria terça somente pelo PedidosYa'));
  assert(!result.includes('tercaSomentePedidosYa'));
  return result;
}
module.exports = { updatePrompt, policy };

async function main() {
 const workspace=path.resolve(__dirname,'../..');
 const config=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(l=>/^[^=]+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
 async function api(route,method='GET',body){const r=await fetch(config.N8N_BASE_URL.replace(/\/$/,'')+'/api/v1/'+route,{method,headers:{'X-N8N-API-KEY':config.N8N_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('n8n API '+r.status);return r.json();}
 const flow=await api('workflows/q2JCUkaCkX6Ab0Wg');
 const agent=flow.nodes.find(n=>n.name==='Agente Gula');assert(agent);
 const next=updatePrompt(agent.parameters.options.systemMessage);
 fs.writeFileSync(path.join(workspace,'n8n-backups-local','before-tuesday-policy-'+Date.now()+'.json'),JSON.stringify(flow));
 agent.parameters.options.systemMessage=next;
 await api('workflows/'+flow.id,'PUT',{name:flow.name,nodes:flow.nodes,connections:flow.connections,settings:flow.settings});
 await api('workflows/'+flow.id+'/activate','POST',{});
 const saved=await api('workflows/'+flow.id);assert(saved.active);assert.equal(saved.nodes.find(n=>n.name===agent.name).parameters.options.systemMessage,next);
 const documented=path.resolve(__dirname,'../docs/PROMPT-AGENTE-2026-10-04.md');
 fs.writeFileSync(documented,updatePrompt(fs.readFileSync(documented,'utf8')));
 console.log('Tuesday/chantilly prompt published and read back. No WhatsApp messages sent.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
