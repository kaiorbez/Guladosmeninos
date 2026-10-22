const LEGACY_PANEL='https://guladosmeninos-production.up.railway.app';
const VERCEL_PANEL='https://guladosmeninos.vercel.app';
/** Update endpoints only; do not rebuild the live workflow, credentials or prompt. */
function patchPanelHost(workflow,base=VERCEL_PANEL){
 const url=new URL(base);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Panel base must be an HTTPS origin');
 const next=url.origin;let replacements=0;
 function replace(value){
  if(typeof value==='string'){replacements+=value.split(LEGACY_PANEL).length-1;return value.replaceAll(LEGACY_PANEL,next);}
  if(Array.isArray(value))return value.map(replace);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replace(v)]));
  return value;
 }
 for(const node of workflow.nodes)node.parameters=replace(node.parameters);
 return {workflow,replacements};
}
module.exports={patchPanelHost,LEGACY_PANEL,VERCEL_PANEL};
