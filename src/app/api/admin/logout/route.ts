import type { NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/admin";
import { json } from "@/lib/http";
import { SESSION_COOKIE, endSession } from "@/lib/passkeys";

// パスキーで入った記録を消して出る
export async function POST(req: NextRequest) {
  await endSession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
}
