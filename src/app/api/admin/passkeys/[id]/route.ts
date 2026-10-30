import type { NextRequest } from "next/server";
import { clearSessionCookie, requireAdminToken } from "@/lib/admin";
import { json } from "@/lib/http";
import { deletePasskey, endAllSessions } from "@/lib/passkeys";

type Ctx = { params: Promise<{ id: string }> };

// パスキーを外す（端末をなくしたときなど）。合言葉をそのたびに確かめる。
// 外したパスキーで入っていた端末も出すため、すべての端末から出る（この端末も入り直す。§8.6）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdminToken(req);
  if (denied) return denied;
  const ok = await deletePasskey((await ctx.params).id);
  if (!ok) return json({ ok }, 404);
  await endAllSessions();
  const res = json({ ok });
  clearSessionCookie(res);
  return res;
}
