function planCatalogMessages(items, steps) {
 const planned=(steps||[]).some(s=>{try{let r=typeof s.observation==='string'?JSON.parse(s.observation):s.observation;if(Array.isArray(r))r=r[0];return s.action?.tool==='enviar_cardapio'&&r?.planejado===true;}catch{return false;}});
 const texts=items.map(i=>String(i.json.mensagem||'').trim()).filter(Boolean);
 if(!texts.length)return [{json:{skip:true}}];
 if(!planned)return texts.map((mensagem,i)=>({json:{mensagem,parte:String(i)}}));
 const whole=texts.join('\n\n');
 // Keep the final question after the document; keep the factual reply before it.
 const match=whole.match(/(?:^|[.!\n]\s*)([¿]?[^.!?\n]*\?[^\p{L}\p{N}]*?)$/u);
 let question=match?match[1].trim():'';
 const answer=question?whole.slice(0,whole.lastIndexOf(match[1])).trim():whole;
 const out=[];if(answer)out.push({mensagem:answer});
 out.push({mensagem:'Cardápio / Menú',catalogo:true});
 if(question)out.push({mensagem:question});
 return out.map((json,i)=>({json:{...json,parte:String(i)}}));
}
function protectionLanguage(history, input) {
 const samples=[...(history||[]).filter(m=>m.papel==='cliente').map(m=>m.texto||''),input||''];
 for(const s of samples.reverse()){
  if(/\b(voc[eê]|obrigad[oa]|quero|gostaria|qual|quanto|amanh[ãa]|boa (?:tarde|noite)|bolos?|recheio)\b/iu.test(s))return 'pt';
  if(/[¿¡]|\b(quiero|quisiera|cu[aá]nto|cu[aá]l|gracias|buenas|buenos|ma[ñn]ana|torta|precio|env[ií]o)\b/iu.test(s))return 'es';
 }return 'pt';
}
module.exports={planCatalogMessages,protectionLanguage};
