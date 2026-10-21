// Keep quoted locations as customer context, including when they have a caption.
function quotedText(q) {
 if(typeof q==='string')return q;
 if(!q||typeof q!=='object')return '';
 const caption=typeof q.text==='string'?q.text:(q.text||{}).message||(typeof q.message==='string'?q.message:'')||q.caption||(q.image||{}).caption||(q.document||{}).caption||'';
 const location=q.location||(q.message&&typeof q.message==='object'?q.message.location:null);
 if(!location)return caption;
 const lat=location.latitude,lon=location.longitude;
 if(lat===null||lat===undefined||lon===null||lon===undefined||String(lat).trim()===''||String(lon).trim()==='')return caption;
 const latitude=Number(lat),longitude=Number(lon);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return caption;
 const reference='[Localização citada: https://maps.google.com/?q='+latitude+','+longitude+(location.address?' '+String(location.address).slice(0,1000):'')+']';
 return [caption,reference].filter(Boolean).join('\n');
}
function patch(w) {
 const entry=w.nodes.find(n=>n.name==='Registrar Entrada Painel');
 if(!entry)throw Error('Registrar Entrada Painel not found');
 const expression=entry.parameters.jsonBody;
 if(!/citacao:[\s\S]*?,anuncio:/.test(expression))throw Error('Quote extraction anchor changed');
 entry.parameters.jsonBody=expression.replace(/citacao:[\s\S]*?,anuncio:/,()=>`citacao:(${quotedText.toString()})(q),anuncio:`);
 return w;
}
module.exports={quotedText,patch};
