import type { NextRequest } from "next/server";
import { clearSessionCookie, requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { endAllSessions } from "@/lib/passkeys";

// すべての端末から出る（入った記録をすべて消す。端末をなくしたときなど。§8.6）
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const ended = await endAllSessions();
  const res = json({ ok: true, ended });
  clearSessionCookie(res);
  return res;
}
