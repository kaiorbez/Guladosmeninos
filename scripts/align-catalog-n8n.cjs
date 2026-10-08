const fs=require('node:fs'),path=require('node:path');
const {planCatalogMessages,protectionLanguage}=require('./catalog-sequence.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
const cfg=Object.fromEntries(fs.readFileSync(path.join(workspace,'n8n-vps.local.env'),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
async function api(p,m='GET',b){const r=await fetch(cfg.N8N_BASE_URL+'/api/v1/'+p,{method:m,headers:{'X-N8N-API-KEY':cfg.N8N_API_KEY,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw Error('n8n '+r.status);return r.json();}
(async()=>{
 const route='workflows/q2JCUkaCkX6Ab0Wg',w=await api(route),node=name=>w.nodes.find(n=>n.name===name);
 fs.writeFileSync(path.join(workspace,'n8n-backups-local/before-catalog-sequence-'+Date.now()+'.json'),JSON.stringify(w));
 const menu=node('enviar_cardapio');menu.parameters.jsonBody=menu.parameters.jsonBody.replace("acao:'menu'","acao:'planejarMenu'");
 menu.parameters.toolDescription='Planeja o PDF no primeiro contato comercial mesmo sem pedido, ou quando solicitado explicitamente. Não repetir em histórico com catálogo enviado nem em acompanhamento/suporte/pausa humana. Retorna planejado=true e enviado=false: responda à dúvida e termine com uma pergunta útil. O fluxo enviará resposta, catálogo e pergunta nessa ordem. Não afirme envio concluído.';
 node('Adicionar Cardapio (1o contato)').parameters.jsCode='return ('+planCatalogMessages.toString()+")($input.all(),$('Agente Gula').first().json.intermediateSteps||[]);";
 node('Enviar Mensagem WhatsApp').parameters.jsonBody="={{ JSON.stringify({acao:$('Loop Mensagens').item.json.catalogo?'menu':'enviar',arquivoUrl:$('Parametros Fluxo').first().json.URL_CARDAPIO,telefone:$('Dados Lead').first().json.IdConversa,messageId:$('Consultar Ficha do Cliente').first().json.messageId,geracao:$('Consultar Ficha do Cliente').first().json.geracao,texto:$('Loop Mensagens').item.json.mensagem,parte:$('Loop Mensagens').item.json.parte||'0'}) }}";
 if(!node('Envio Confirmado?')){let n=structuredClone(node('Envio Pausado?'));n.id='catalog-send-confirmed';n.name='Envio Confirmado?';n.position=[3600,1500];w.nodes.push(n);}
 node('Envio Confirmado?').parameters.conditions.conditions[0].leftValue='={{ $json.enviado === true }}';
 const edge=name=>[{node:name,type:'main',index:0}];w.connections['Enviar Mensagem WhatsApp']={main:[edge('Envio Confirmado?')]};w.connections['Envio Confirmado?']={main:[edge('Espera Entre Mensagens'),edge('Fim Envio')]};
 const guard=node('Conferir Resposta e Resultados');
 const old="text=successful('avisar_equipe','registrado')?'Sua solicitação está registrada no painel e aguarda conferência da equipe.':'Ainda não tenho confirmação para essa informação. Preciso da conferência da equipe.';";
 if(!guard.parameters.jsCode.includes(old))throw Error('Protection anchor missing');
 guard.parameters.jsCode=guard.parameters.jsCode.replace(old,"const spanish=("+protectionLanguage.toString()+")(current.historico,current.message)==='es';\n text=successful('avisar_equipe','registrado')?(spanish?'Tu solicitud está registrada y pendiente de revisión del equipo.':'Sua solicitação está registrada no painel e aguarda conferência da equipe.'):(spanish?'Todavía no tengo confirmación de esa información. Necesito que el equipo la revise.':'Ainda não tenho confirmação para essa informação. Preciso da conferência da equipe.');");
 node('Agente Gula').parameters.options.systemMessage=fs.readFileSync(path.join(root,'docs/PROMPT-AGENTE-COMPACTO.md'),'utf8').trim();
 await api(route,'PUT',{name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});await api(route+'/activate','POST',{});
 const live=await api(route);for(const name of ['enviar_cardapio','Adicionar Cardapio (1o contato)','Enviar Mensagem WhatsApp','Conferir Resposta e Resultados','Agente Gula'])if(JSON.stringify(node(name).parameters)!==JSON.stringify(live.nodes.find(n=>n.name===name).parameters))throw Error('Readback '+name);
 if(!live.active||JSON.stringify(live.connections)!==JSON.stringify(w.connections))throw Error('Connections mismatch');console.log(JSON.stringify({active:true,catalogOrder:true,localizedProtection:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
