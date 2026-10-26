import type { NextRequest } from "next/server";
import { getPublic, hasResponded } from "@/lib/surveys";
import { hostCookie, isId, json, respondentCookie } from "@/lib/http";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ surveyId: string }> },
) {
  const { surveyId } = await ctx.params;
  if (!isId(surveyId)) return json({ error: "not_found" }, 404);
  const view = await getPublic(surveyId);
  if (!view) return json({ error: "not_found" }, 404);
  const isHost = req.cookies.has(hostCookie(surveyId));
  const key = req.cookies.get(respondentCookie(surveyId))?.value;
  const answered = key ? await hasResponded(surveyId, key) : false;
  return json({ ...view, isHost, answered });
}
