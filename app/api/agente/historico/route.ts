import { agentAuthorized, unauthorized } from '@/lib/agent-auth';
import { AgentError } from '@/lib/agent/rules';
import { recoverHistory } from '@/lib/agent/recovered-history';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!agentAuthorized(req))return unauthorized();
 try{
  const raw=await req.text();
  if(raw.length>1500000)throw new AgentError('Lote muito grande.');
  return Response.json(await recoverHistory(JSON.parse(raw)));
 }catch(e){
  if(e instanceof AgentError)return Response.json({ok:false,error:e.message},{status:e.status});
  if(e instanceof SyntaxError)return Response.json({ok:false,error:'JSON inválido.'},{status:400});
  return Response.json({ok:false,error:'Histórico não importado.'},{status:500});
 }
}
