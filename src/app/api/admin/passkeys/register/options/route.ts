import type { NextRequest } from "next/server";
import { relyingParty, requireAdminToken } from "@/lib/admin";
import { json } from "@/lib/http";
import { registrationOptions } from "@/lib/passkeys";

// パスキーを登録するための値（合言葉をそのたびに確かめる。§8.6）
export async function POST(req: NextRequest) {
  const denied = await requireAdminToken(req);
  if (denied) return denied;
  const rp = relyingParty(req);
  if (!rp) return json({ error: "bad_request" }, 400);
  return json(await registrationOptions(rp));
}
