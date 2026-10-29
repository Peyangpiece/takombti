import type { NextRequest } from "next/server";
import { relyingParty } from "@/lib/admin";
import { allowEvent, clientIp, isLimited, json } from "@/lib/http";
import { loginOptions } from "@/lib/passkeys";

// パスキーで入るための値
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // 失敗の回数に加えて、この入口を開く回数も 1 時間に 60 回まで（1 回ごとにデータベースに乱数を書くため）
  if (
    (await isLimited(ip, "admin-failure")) ||
    !(await allowEvent(ip, "admin-options"))
  )
    return json({ error: "rate_limited" }, 429);
  const rp = relyingParty(req);
  if (!rp) return json({ error: "bad_request" }, 400);
  return json(await loginOptions(rp));
}
