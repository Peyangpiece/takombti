import type { NextRequest } from "next/server";
import { relyingParty, requireAdmin } from "@/lib/admin";
import { json, readJson } from "@/lib/http";
import { registerPasskey } from "@/lib/passkeys";

// 端末が作ったパスキーを確かめて登録する
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const rp = relyingParty(req);
  const body = await readJson(req);
  if (!rp || !body) return json({ error: "bad_request" }, 400);
  const ok = await registerPasskey(rp, body.response, body.name);
  return ok ? json({ ok }, 201) : json({ error: "not_verified" }, 400);
}
