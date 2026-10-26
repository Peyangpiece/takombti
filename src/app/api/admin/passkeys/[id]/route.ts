import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { deletePasskey } from "@/lib/passkeys";

type Ctx = { params: Promise<{ id: string }> };

// パスキーを外す（端末をなくしたときなど）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const ok = await deletePasskey((await ctx.params).id);
  return json({ ok }, ok ? 200 : 404);
}
