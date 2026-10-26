import type { NextRequest } from "next/server";
import { relyingParty, requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { registrationOptions } from "@/lib/passkeys";

// パスキーを登録するための値（入っている運営者だけ）
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const rp = relyingParty(req);
  if (!rp) return json({ error: "bad_request" }, 400);
  return json(await registrationOptions(rp));
}
