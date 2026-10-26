import type { NextRequest } from "next/server";
import { deleteSurveyById, getPublic } from "@/lib/surveys";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";

type Ctx = { params: Promise<{ surveyId: string }> };

// 報告された診断の呼び名と状態を見る（回答の中身は見せない）
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const view = await getPublic((await ctx.params).surveyId);
  return view ? json(view) : json({ error: "not_found" }, 404);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const ok = await deleteSurveyById((await ctx.params).surveyId);
  return json({ ok }, ok ? 200 : 404);
}
