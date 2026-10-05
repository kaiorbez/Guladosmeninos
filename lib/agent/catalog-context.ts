type Item = Record<string, unknown>;
/** Explicit families, with an unfiltered fallback for unknown queries. Never infer stock. */
export function catalogForPrompt(items: Item[], query: unknown) {
 const normalize=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
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
 const selected=all?items:items.filter(item=>families.includes(family(item)));
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
 return {ok:true,escopo:all?'todos':families.join(','),totalCatalogo:items.length,totalRetornado:selected.length,formato:'variantes agrupadas',colunas:columns,grupos:groups};
}
