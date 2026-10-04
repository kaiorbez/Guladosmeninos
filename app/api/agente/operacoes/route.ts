import { agentAuthorized, unauthorized } from '@/lib/agent-auth';
import { AgentError } from '@/lib/agent/rules';
import { operate } from '@/lib/agent/service';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return unauthorized();
  try {
    const raw = await req.text();
    if (raw.length > 100000) return Response.json({ ok: false, error: 'Requisição muito grande.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AgentError('JSON inválido.');
    return Response.json(await operate(body));
  } catch (e) {
    if (e instanceof AgentError) return Response.json({ ok: false, error: e.message }, { status: e.status });
    if (e instanceof SyntaxError) return Response.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
    console.error('[agente/operacoes] Operação falhou:', e instanceof Error ? e.name : 'erro');
    return Response.json({ ok: false, error: 'Não foi possível concluir. Não afirme sucesso; consulte o painel.' }, { status: 500 });
  }
}
