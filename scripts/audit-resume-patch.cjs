function patch(w){
 const n=name=>{const v=w.nodes.find(x=>x.name===name);if(!v)throw Error(name);return v;};
 const clone=(name,source)=>{if(!w.nodes.some(x=>x.name===name)){const v=structuredClone(n(source));v.id=name.replaceAll(' ','-');v.name=name;v.position=[4000,400+w.nodes.length*8];w.nodes.push(v);}return n(name);};
 const edge=name=>[{node:name,type:'main',index:0}];
 const mapping=clone('Mapear Telefone para LID','Mapear LID do Cliente');
 mapping.parameters.key="=gula_phone_lid_{{ $('Dados Lead').first().json.IdConversa }}";
 mapping.parameters.value="={{ $('Webhook').first().json.body.chatLid || '' }}";
 const hasLid=clone('Cliente Possui LID?','Envio Confirmado?');hasLid.parameters.conditions.conditions[0].leftValue="={{ !!$('Webhook').first().json.body.chatLid && $('Registrar Entrada Painel').first().json.ok === true && $('Registrar Entrada Painel').first().json.ignorar === false }}";
 w.connections[hasLid.name]={main:[edge('Mapear LID do Cliente'),[]]};
 w.connections['Mapear LID do Cliente']={main:[edge(mapping.name)]};
 const resumed=clone('Equipe Liberou Atendimento?','Envio Confirmado?');resumed.parameters.conditions.conditions[0].leftValue='={{ $json.ok === true && $json.retomado === true && !!$json.telefone }}';
 const lookup=clone('Buscar LID para Retomada','Resolver LID (equipe)');lookup.parameters.key="=gula_phone_lid_{{ $('Processar Resposta da Equipe').first().json.telefone }}";lookup.parameters.propertyName='lidRetomada';
 const clearPhone=clone('Liberar Pausa Resolvida','Reset Status');clearPhone.parameters.key="={{ $('Processar Resposta da Equipe').first().json.telefone }}_gula_status";
 const clearLid=clone('Liberar Pausa LID Resolvida','Reset Status');clearLid.parameters.key="={{ $('Buscar LID para Retomada').first().json.lidRetomada || 'sem-lid-resolvido' }}_gula_status";
 w.connections['Processar Resposta da Equipe']={main:[edge(resumed.name)]};w.connections[resumed.name]={main:[edge(lookup.name),[]]};w.connections[lookup.name]={main:[edge(clearPhone.name)]};w.connections[clearPhone.name]={main:[edge(clearLid.name)]};
 // Authorized test command must be reachable during a pause, never for duplicates.
 const reset=n('Comando Reset?').parameters.conditions.conditions[0];if(!reset.leftValue.includes("Registrar Entrada Painel"))reset.leftValue=reset.leftValue.replace('={{ ','={{ $(\'Registrar Entrada Painel\').first().json.ok === true && $(\'Registrar Entrada Painel\').first().json.ignorar === false && (').replace(/ }}$/,' ) }}');
 w.connections['Registrar Entrada Painel']={main:[[...edge('Comando Reset?'),...edge(hasLid.name)]]};
 w.connections['Comando Reset?'].main[1]=edge('Entrada Nova e Liberada?');
 w.connections['Entrada Nova e Liberada?']={main:[edge('Buscar Status Agente')]};
 const panel=clone('Reset Atendimento Painel','Registrar Entrada Painel');panel.parameters.jsonBody="={{ JSON.stringify({acao:'reiniciarAtendimento',telefone:$('Dados Lead').first().json.IdConversa,messageId:$('Webhook').first().json.body.messageId,geracao:$('Registrar Entrada Painel').first().json.geracao}) }}";
 w.connections['Comando Reset?'].main[0]=edge(panel.name);w.connections[panel.name]={main:[edge('Reset Memoria')]};
 const lidReset=clone('Reset Pausa LID','Reset Status');lidReset.parameters.key="={{ $('Webhook').first().json.body.chatLid || 'sem-lid-reset' }}_gula_status";
 w.connections['Reset Status']={main:[edge(lidReset.name)]};w.connections[lidReset.name]={main:[edge('Reset Buffer')]};
 return w;
}
module.exports={patch};
