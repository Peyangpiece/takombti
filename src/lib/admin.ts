// 運営者用 API の共通部品。入り方は 2 つ（仕様書 §8.6）：
// - 合言葉（ADMIN_TOKEN）を X-Admin-Token 見出しで送る
// - 入ったときに渡した cookie（tka_session）。パスキー（指紋・顔認証）か、合言葉を一度送って受け取る。
//   画面は合言葉をブラウザに残さず、すぐに cookie に替える
// パスキーの登録と取り外しは、cookie で入っていても、そのたびに合言葉を求める（§8.6）
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
  if (await isLimited(ip, "admin-failure"))
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
  await allowResponse(ip, "admin-failure");
  return json({ error: "unauthorized" }, 401);
}

// パスキーの登録・取り外しのような、入る手段そのものを変える操作のための確かめ。
// cookie だけでは通さず、合言葉（X-Admin-Token）をそのたびに求める。
// cookie を盗まれても、その cookie だけで自分のパスキーを足して居座ったり、運営者のパスキーを外して締め出したりできないように。
// まちがいは、ほかの合言葉のまちがいと同じく数える
export async function requireAdminToken(req: NextRequest) {
  const ip = clientIp(req);
  if (await isLimited(ip, "admin-failure"))
    return json({ error: "rate_limited" }, 429);
  const token = req.headers.get("x-admin-token");
  if (!token) return json({ error: "token_required" }, 401);
  if (isAdmin(token)) return null;
  await allowResponse(ip, "admin-failure");
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
