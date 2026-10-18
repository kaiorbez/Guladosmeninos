type Item = { produto: string; preco: number; precoSobConsulta: boolean };
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/\bmaracuya\b/g,'maracuja').replace(/\bnido\b/g,'ninho').replace(/\bzanahoria\b/g,'cenoura')
 .replace(/\bfrutos\b/g,'frutas').replace(/\brojos\b/g,'vermelhas').replace(/\bfrutillas?\b/g,'morango').replace(/\bnueces|\bnuez\b/g,'nozes');
const family=(s:string)=>/porc(?:ion|iones|ao|oes)|fatia/.test(s)?'fatias':/pote|cuchareable/.test(s)?'potes':null;
const productFamily=(s:string)=>/^fatia\b|^porcao\b.*torta/.test(s)?'fatias':/^pote\b/.test(s)?'potes':null;
const noise=new Set(['fatia','porcao','pote','torta','premium','especial','de','com','e','do','da','um','uma']);
/** Conservative validation of unambiguous individual ready-product prices. Totals, freight, combos and multi-unit offers are not unit quotes. */
export function quotedPriceIssues(message:string, items:Item[]) {
 const issues:Array<{produto:string;precoCitado:number;precoAtual:number}>=[];
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
   const quantity=/\b(\d+)\s*(?:x\s*)?(?:porc|fatia|pote|cuchareable)/.exec(clause);
   if(quantity&&Number(quantity[1])!==1&&!/cada|por unidade|por unidad|c\/u/.test(clause))continue;
   const kind=family(clause)||section;if(!kind)continue;
   const candidates=items.filter(p=>!p.precoSobConsulta&&productFamily(normalize(p.produto))===kind).map(p=>({p,tokens:normalize(p.produto).split(/[^a-z0-9]+/).filter(t=>t.length>1&&!noise.has(t))})).filter(x=>x.tokens.length&&x.tokens.every(t=>new RegExp('\\b'+t+'\\b').test(clause)));
   const best=Math.max(0,...candidates.map(x=>x.tokens.length));
   const found=candidates.filter(x=>x.tokens.length===best);
   if(!found.length||new Set(found.map(x=>x.p.produto)).size!==1||new Set(found.map(x=>x.p.preco)).size!==1)continue;
   const p=found[0].p,amount=Number((price[1]||price[2]).replace(',','.'));
   if(amount!==Number(p.preco)&&!issues.some(x=>x.produto===p.produto&&x.precoCitado===amount))issues.push({produto:p.produto,precoCitado:amount,precoAtual:Number(p.preco)});
  }
 }
 return issues;
}
