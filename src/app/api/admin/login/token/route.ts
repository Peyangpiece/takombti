import type { NextRequest } from "next/server";
import { setSessionCookie } from "@/lib/admin";
import { allowResponse, clientIp, isLimited, json, readJson } from "@/lib/http";
import { isAdmin } from "@/lib/inquiries";
import { createSession } from "@/lib/passkeys";

// 合言葉を確かめて、12 時間使える鍵を cookie で渡す（§8.6）。
// 画面は合言葉をブラウザに残さず、これで cookie に替える。まちがいはほかの合言葉のまちがいと同じく数える
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (await isLimited(ip, "admin-failure"))
    return json({ error: "rate_limited" }, 429);
  const body = await readJson(req);
  const token = typeof body?.token === "string" ? body.token : null;
  if (!isAdmin(token)) {
    await allowResponse(ip, "admin-failure");
    return json({ error: "unauthorized" }, 401);
  }
  const res = json({ ok: true });
  setSessionCookie(res, await createSession());
  return res;
}
