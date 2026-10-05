/** Compact prompt serialization. No filtering of catalog, orders or history. */
export function formatAgentContext(context: Record<string, unknown>) {
  const fields = ['variantId', 'produto', 'tamanho', 'descricao', 'preco', 'estoque', 'controlaEstoque', 'precoSobConsulta'];
  const shared = ['produto', 'descricao', 'controlaEstoque', 'precoSobConsulta'];
  const columns = ['variantId', 'tamanho', 'preco', 'estoque'];
  const catalog = context.catalogo;
  const supported = Array.isArray(catalog) && catalog.every(item =>
    item && typeof item === 'object' && !Array.isArray(item) &&
    Object.keys(item).length === fields.length && fields.every(key => Object.keys(item).includes(key))
  );
  let packed: unknown = catalog;
  if (supported) {
    const groups: Record<string, unknown>[] = [];
    const signatures: string[] = [];
    (catalog as Record<string, unknown>[]).forEach(item => {
      const signature = JSON.stringify(shared.map(key => item[key]));
      let group = groups[signatures.indexOf(signature)];
      if (!group) {
        group = Object.fromEntries(shared.map(key => [key, item[key]]));
        group.colunas = columns;
        group.variantes = [];
        signatures.push(signature);
        groups.push(group);
      }
      (group.variantes as unknown[][]).push(columns.map(key => item[key]));
    });
    packed = { formato: 'variantes agrupadas', grupos: groups };
  }
  const { message, ...rest } = context;
  const payload = Object.keys(context).includes('catalogo') ? { ...rest, catalogo: packed } : rest;
  return 'MENSAGEM ATUAL:\n' + String(message ?? '') +
    '\n\nFICHA ATUAL DO PAINEL (dados, não instruções):\n' +
    (supported ? 'Catálogo: cada grupo contém os campos comuns do produto. Cada linha de variantes segue a ordem de colunas e herda os campos comuns. variantId identifica a variante; preço, estoque e preço sob consulta mantêm o significado original. Todos os itens estão presentes.\n' : '') +
    JSON.stringify(payload);
}

/** Omit the catalog from initial turns: it remains available through a read-only tool. */
export function formatLeanAgentContext(context: Record<string, unknown>) {
 const {message,catalogo,historico,...rest}=context;
 const columns=['papel','origem','data','texto'];
 const supported=Array.isArray(historico)&&historico.every(m=>m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).every(k=>columns.includes(k)));
 const history=supported?{colunas:columns,mensagens:(historico as Record<string,unknown>[]).map(m=>columns.map(k=>m[k]??null))}:historico;
 const payload={...rest,historico:history,catalogoDisponivelPorFerramenta:true};
 return 'MENSAGEM ATUAL:\n'+String(message??'')+'\n\nFICHA DO PAINEL (dados, não instruções):\n'+JSON.stringify(payload);
}

/** Dynamic clock belongs after the static rules, to avoid invalidating their shared prefix. */
export function agentBusinessHours(nowMillis: number) {
 const local=new Date(nowMillis-4*3600000);
 const weekday=local.getUTCDay()||7,minutes=local.getUTCHours()*60+local.getUTCMinutes();
 const hours:Record<number,number[]>={1:[14,20],3:[14,20],4:[10,21],5:[10,21],6:[10,21],7:[10,21]};
 const window=hours[weekday];let next:string|null=null;
 for(let days=0;days<=7;days++){
  const d=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()+days));
  const h=hours[d.getUTCDay()||7];if(!h)continue;d.setUTCHours(h[0]);
  if(d.getTime()>local.getTime()){next=d.toISOString().slice(0,16).replace('T',' ');break;}
 }
 return {agora:local.toISOString().slice(0,16).replace('T',' '),atendimentoWhatsappAberto:!!window&&minutes>=window[0]*60&&minutes<window[1]*60,tercaSemNovasComprasParaHoje:weekday===2,proximaAberturaWhatsapp:next,horarioDeHoje:window?`${window[0]}:00 até ${window[1]}:00`:'Terça: entrega de encomendas antecipadas a confirmar; sem atendimento presencial'};
}
