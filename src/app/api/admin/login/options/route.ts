import type { NextRequest } from "next/server";
import { relyingParty } from "@/lib/admin";
import { clientIp, isLimited, json } from "@/lib/http";
import { loginOptions } from "@/lib/passkeys";

// パスキーで入るための値
export async function POST(req: NextRequest) {
  if (isLimited(clientIp(req), "admin-failure"))
    return json({ error: "rate_limited" }, 429);
  const rp = relyingParty(req);
  if (!rp) return json({ error: "bad_request" }, 400);
  return json(await loginOptions(rp));
}
