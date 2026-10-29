import type { NextRequest } from "next/server";
import { getPublic, hasResponded, newId } from "@/lib/surveys";
import {
  hostCookie,
  isId,
  json,
  respondentCookie,
  setSurveyCookie,
} from "@/lib/http";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ surveyId: string }> },
) {
  const { surveyId } = await ctx.params;
  if (!isId(surveyId)) return json({ error: "not_found" }, 404);
  const view = await getPublic(surveyId);
  if (!view) return json({ error: "not_found" }, 404);
  const isHost = req.cookies.has(hostCookie(surveyId));
  const name = respondentCookie(surveyId);
  const saved = req.cookies.get(name)?.value;
  const answered = saved ? await hasResponded(surveyId, saved) : false;
  const res = json({ ...view, isHost, answered });
  // 回答者の鍵は、答える前（招待のページを開いたとき）に渡す。送った返事が途中で切れて鍵を受け取れないと、
  // 送り直しが別の人の回答として数えられてしまうため（§5.3）。ホストの印も、送られる範囲を狭めて付け直す
  setSurveyCookie(res, name, saved ?? newId(), surveyId);
  if (isHost) setSurveyCookie(res, hostCookie(surveyId), "1", surveyId);
  return res;
}
