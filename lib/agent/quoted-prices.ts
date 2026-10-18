type Item = { produto: string; preco: number; precoSobConsulta: boolean; controlaEstoque?: boolean; estoque?: number };
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/\bmaracuya\b/g,'maracuja').replace(/\bnido\b/g,'ninho').replace(/\bzanahoria\b/g,'cenoura')
 .replace(/\bfrutos\b/g,'frutas').replace(/\brojos\b/g,'vermelhas').replace(/\bfrutillas?\b/g,'morango').replace(/\bnueces|\bnuez\b/g,'nozes');
const family=(s:string)=>/porc(?:ion|iones|ao|oes)|fatia/.test(s)?'fatias':/pote|cuchareable/.test(s)?'potes':null;
const productFamily=(s:string)=>/^fatia\b|^porcao\b.*torta/.test(s)?'fatias':/^pote\b/.test(s)?'potes':null;
const noise=new Set(['fatia','porcao','pote','torta','premium','especial','de','com','e','do','da','um','uma']);
/** Conservative validation of unambiguous individual ready-product prices. Totals, freight, combos and multi-unit offers are not unit quotes. */
export function quotedPriceIssues(message:string, items:Item[]) {
 const issues:Array<{produto:string;precoCitado:number;precoAtual:number|null;motivo?:string}>=[];
 let section:string|null=null;
 for(const rawLine of message.split('\n')) {
  const line=normalize(rawLine.replace(/\*/g,''));
  if(!/\bbs\b/.test(line)){if(/:\s*$/.test(line))section=family(line);continue;}
  const prices=[...line.matchAll(/(?:\bbs\.?\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*bs\.?\b)/g)];
  let start=0;
  for(const price of prices){
   const clause=line.slice(start,price.index);start=(price.index||0)+price[0].length;
   if(/\b(?:total|subtotal|frete|envio|sinal|saldo|pagar|pagamento|pago)\b/.test(clause)&&!/(?:porcao|porcion|fatia|pote|cuchareable)/.test(clause))continue;
   if(/\b(?:combo|promo|promocion|par de|par promocional)\b/.test(clause))continue;
   const quantity=/\b(\d+|um|uma|uno|una|dois|duas|dos|tres|quatro|cuatro|cinco|seis|sete|siete|oito|ocho|nove|nueve|dez|diez)\s*(?:[x×]\s*)?(?:bolos? (?:de|no) )?(?:porc|fatia|pote|cuchareable)/.exec(clause) || /(?:pote|fatia|porcion)[^:;]*?\b[x×]\s*(\d+)\b/.exec(clause) || /\b(\d+)\s*unidades?\b/.exec(clause);
   const numbers:Record<string,number>={um:1,uma:1,uno:1,una:1,dois:2,duas:2,dos:2,tres:3,quatro:4,cuatro:4,cinco:5,seis:6,sete:7,siete:7,oito:8,ocho:8,nove:9,nueve:9,dez:10,diez:10};
   const count=quantity?(numbers[quantity[1]]||Number(quantity[1])):1;
   const multiplier=/cada|por unidade|por unidad|c\/u/.test(clause)?1:count;
   const kind=family(clause)||section;if(!kind)continue;
   const candidates=items.filter(p=>!p.precoSobConsulta&&productFamily(normalize(p.produto))===kind).map(p=>({p,tokens:normalize(p.produto).split(/[^a-z0-9]+/).filter(t=>t.length>1&&!noise.has(t))})).filter(x=>x.tokens.length&&x.tokens.every(t=>new RegExp('\\b'+t+'\\b').test(clause)));
   const best=Math.max(0,...candidates.map(x=>x.tokens.length));
   const found=candidates.filter(x=>x.tokens.length===best);
   if(!found.length){
    // Do not invent a price for a named flavor absent from this product family.
    if(/\b(ninho|prestigio|maracuja|brigadeiro|cenoura|morango|nozes|frutas)\b/.test(clause)&&!/[?]|\b(?:nao|no tenemos|indisponivel|agotad|esgotad|sin stock|sem estoque|antes|historico)\b/.test(clause))issues.push({produto:clause.trim().replace(/^[-•\s]+/,''),precoCitado:Number((price[1]||price[2]).replace(',','.')),precoAtual:null,motivo:'FORA_CATALOGO'});
    continue;
   }
   if(new Set(found.map(x=>x.p.produto)).size!==1||new Set(found.map(x=>x.p.preco)).size!==1)continue;
   const p=found[0].p,amount=Number((price[1]||price[2]).replace(',','.'));
   if(p.controlaEstoque===true&&Number(p.estoque)<=0&&!/[?]|\b(?:nao|no tenemos|indisponivel|agotad|esgotad|sin stock|sem estoque|antes|historico)\b/.test(clause)){issues.push({produto:p.produto,precoCitado:amount,precoAtual:null,motivo:'SEM_ESTOQUE'});continue;}
   const expected=Number(p.preco)*multiplier;
   if(amount!==expected&&!issues.some(x=>x.produto===p.produto&&x.precoCitado===amount))issues.push({produto:p.produto,precoCitado:amount,precoAtual:expected});
  }
 }
 return issues;
}
