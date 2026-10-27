import type { NextRequest } from "next/server";
import { deleteSurveyById, getPublic } from "@/lib/surveys";
import { requireAdmin } from "@/lib/admin";
import { json, readJson } from "@/lib/http";
import { setStatsTest } from "@/lib/funnel";

type Ctx = { params: Promise<{ surveyId: string }> };

// 報告された診断の呼び名と状態を見る（回答の中身は見せない）
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const view = await getPublic((await ctx.params).surveyId);
  return view ? json(view) : json({ error: "not_found" }, 404);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const ok = await deleteSurveyById((await ctx.params).surveyId);
  return json({ ok }, ok ? 200 : 404);
}

// 診断をテストとして集計から外す（または戻す。§11.11）。本文 { test: true | false }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await readJson(req);
  if (typeof body?.test !== "boolean")
    return json({ error: "bad_request" }, 400);
  const ok = await setStatsTest((await ctx.params).surveyId, body.test);
  return json({ ok }, ok ? 200 : 404);
}
