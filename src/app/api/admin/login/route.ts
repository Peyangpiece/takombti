import type { NextRequest } from "next/server";
import { relyingParty, setSessionCookie } from "@/lib/admin";
import { allowResponse, clientIp, isLimited, json, readJson } from "@/lib/http";
import { loginWithPasskey } from "@/lib/passkeys";

// パスキーを確かめて、12 時間使える鍵を cookie で渡す。まちがいは合言葉のまちがいと同じく数える
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isLimited(ip, "admin-failure"))
    return json({ error: "rate_limited" }, 429);
  const rp = relyingParty(req);
  const body = await readJson(req);
  const token = rp && body ? await loginWithPasskey(rp, body.response) : null;
  if (!token) {
    allowResponse(ip, "admin-failure");
    return json({ error: "not_verified" }, 401);
  }
  const res = json({ ok: true });
  setSessionCookie(res, token);
  return res;
}
