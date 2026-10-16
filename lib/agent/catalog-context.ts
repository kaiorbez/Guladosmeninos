type Item = Record<string, unknown>;
/** Explicit families, with an unfiltered fallback for unknown queries. Never infer stock. */
const STOP=new Set(['de','da','do','das','dos','com','e','a','o','as','os','para','por','um','uma','y','con','el','la','los','las','en','del','al','sabor','sabores']);
// Customers often write in Spanish; catalog names are in Portuguese.
const SYN:Record<string,string>={maracuya:'maracuja',frutilla:'morango',frutillas:'morango',nido:'ninho',zanahoria:'cenoura',porcion:'fatia',porciones:'fatia',cuchareable:'pote',cuchareables:'pote',queque:'torta',dulce:'doce',leche:'leite',avellana:'avela',cereza:'cereja',limon:'limao',mani:'amendoim',empanadita:'empadinha'};
/** Optional name search: returns the products matching the most search terms; falls back to families when nothing matches. */
export function catalogForPrompt(items: Item[], query: unknown, search?: unknown) {
 const normalize=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const terms=normalize(search).split(/[^a-z0-9]+/).filter(t=>t.length>1&&!STOP.has(t)).map(t=>SYN[t]||t);
 if(terms.length){
  const has=(text:string,t:string)=>text.includes(t)||(t.length>4&&t.endsWith('s')&&text.includes(t.slice(0,-1)));
  const full=(item:Item)=>normalize(item.produto)+' '+normalize(item.descricao);
  const score=(item:Item)=>terms.filter(t=>has(full(item),t)).length;
  const best=Math.max(0,...items.map(score));
  const found=best?items.filter(item=>score(item)===best):[];
  if(found.length){ const r=catalogForPrompt(found,'todos') as Item; return {...r,escopo:'busca',busca:String(search),totalCatalogo:items.length}; }
  const r=catalogForPrompt(items,query) as Item; return {...r,busca:String(search),buscaSemResultado:true};
 }
 const families=normalize(query).split(/[,;]+/).map(x=>x.trim()).filter(Boolean);
 const known=['bolos','personalizados','potes','fatias','docinhos','salgados','bebidas','kits','adicionais','todos'];
 const all=!families.length||families.includes('todos')||families.some(x=>!known.includes(x));
 const family=(item:Item)=>{
  const name=normalize(item.produto);
  if(/^pote\b/.test(name))return 'potes';
  if(/^fatia\b/.test(name))return 'fatias';
  if(/^docinh/.test(name))return 'docinhos';
  if(/^empad|^torta pao/.test(name))return 'salgados';
  if(/^coca|^fanta|^sprite/.test(name))return 'bebidas';
  if(/^kit|^combo/.test(name))return 'kits';
  if(item.precoSobConsulta===true)return 'personalizados';
  if(/^torta\b/.test(name))return 'bolos';
  return 'adicionais';
 };
 // Numbered catalog designs must remain discoverable even if the customer calls them customized.
 const selected=all?items:items.filter(item=>families.includes(family(item)) || (families.includes('personalizados') && /^torta em acetato modelo \d+$/.test(normalize(item.produto))));
 const columns=['variantId','tamanho','preco','estoque'];
 const common=['produto','descricao','controlaEstoque','precoSobConsulta'];
 const supported=selected.every(item=>Object.keys(item).length===8&&[...columns,...common].every(k=>Object.keys(item).includes(k)));
 if(!supported)return {ok:true,escopo:all?'todos':families.join(','),totalCatalogo:items.length,itens:selected};
 const groups: Item[]=[], signatures:string[]=[];
 for(const item of selected){
  const signature=JSON.stringify(common.map(k=>item[k]));let group=groups[signatures.indexOf(signature)];
  if(!group){group=Object.fromEntries(common.map(k=>[k,item[k]]));group.variantes=[];groups.push(group);signatures.push(signature);}
  (group.variantes as unknown[][]).push(columns.map(k=>item[k]));
 }
 const rules=shareRules(groups);
 return {ok:true,escopo:all?'todos':families.join(','),totalCatalogo:items.length,totalRetornado:selected.length,formato:'variantes agrupadas',colunas:columns,...rules,grupos:groups};
}

const RULE_MARK='DISPONIBILIDADE PERMANENTE AUTORIZADA:';
/** The same long authorization paragraph is stored on dozens of cakes; send it once and reference it by id. */
function shareRules(groups: Item[]) {
 const texts:string[]=[];
 for(const group of groups){
  const desc=String(group.descricao??''), at=desc.indexOf(RULE_MARK);
  if(at<0) continue;
  const rule=desc.slice(at).trim();
  let index=texts.indexOf(rule); if(index<0){texts.push(rule);index=texts.length-1;}
  group.descricao=(desc.slice(0,at).trim()+` [Disponibilidade permanente autorizada: ver regrasDisponibilidade.R${index+1}]`).trim();
 }
 return texts.length?{regrasDisponibilidade:Object.fromEntries(texts.map((t,i)=>[`R${i+1}`,t]))}:{};
}
