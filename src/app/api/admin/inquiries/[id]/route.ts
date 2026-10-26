import type { NextRequest } from "next/server";
import { deleteInquiry, setInquiryHandled } from "@/lib/inquiries";
import { requireAdmin } from "@/lib/admin";
import { json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

async function idOf(ctx: Ctx): Promise<number | null> {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = await idOf(ctx);
  const body = await readJson(req);
  if (!id || typeof body?.handled !== "boolean")
    return json({ error: "bad_request" }, 400);
  const ok = await setInquiryHandled(id, body.handled);
  return json({ ok }, ok ? 200 : 404);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = await idOf(ctx);
  if (!id) return json({ error: "bad_request" }, 400);
  const ok = await deleteInquiry(id);
  return json({ ok }, ok ? 200 : 404);
}
