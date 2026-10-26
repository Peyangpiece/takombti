import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { listPasskeys } from "@/lib/passkeys";

// 登録したパスキーの一覧
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return json({ passkeys: await listPasskeys() });
}
