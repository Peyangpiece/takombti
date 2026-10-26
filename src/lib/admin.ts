// 運営者用 API の共通部品。入り方は 2 つ（仕様書 §8.6）：
// - 合言葉（ADMIN_TOKEN）を X-Admin-Token 見出しで送る
// - パスキー（指紋・顔認証）で入ったときに渡した cookie（tka_session）
import type { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "./inquiries";
import { allowResponse, clientIp, isLimited, json } from "./http";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  isSession,
  relyingPartyOf,
  type RelyingParty,
} from "./passkeys";

// 入れていれば null、入れなければ断りの応答を返す。
// まちがいが続く回線は 1 時間止める。止めている間は確かめもしない（総当たりで当てられないように）
export async function requireAdmin(req: NextRequest) {
  const ip = clientIp(req);
  if (isLimited(ip, "admin-failure"))
    return json({ error: "rate_limited" }, 429);
  const token = req.headers.get("x-admin-token");
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    if (isAdmin(token)) return null;
  } else if (session) {
    if (await isSession(session)) return null;
  } else {
    // 何も送られていない（まだ入っていない）ときは、まちがいとして数えない
    return json({ error: "unauthorized" }, 401);
  }
  allowResponse(ip, "admin-failure");
  return json({ error: "unauthorized" }, 401);
}

// パスキーを使う API で、ドメイン（rpID）とアドレスの始まり（origin）を決める
export function relyingParty(req: NextRequest): RelyingParty | null {
  return relyingPartyOf(req.headers.get("host"));
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
    maxAge: 0,
  });
}
