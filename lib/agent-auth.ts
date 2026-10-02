import { timingSafeEqual } from "node:crypto";

/** Valida o header `Authorization: Bearer <AGENT_API_TOKEN>` das rotas do agente. */
export function agentAuthorized(req: Request): boolean {
  const expected = process.env.AGENT_API_TOKEN;
  if (!expected || expected.length < 16) return false; // sem token configurado, a API fica fechada
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized() {
  return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
}
