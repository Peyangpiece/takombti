import type { NextRequest } from "next/server";
import { isCloudflareWorkers } from "@/lib/db";
import { notifyCompleted } from "@/lib/push";
import { isOrigin } from "@/data/funnel";
import { newId, submitResponse } from "@/lib/surveys";
import {
  REJECT_LIMIT,
  RESPONSE_LIMIT,
  allowResponse,
  clientIp,
  hostCookie,
  isId,
  isLimited,
  json,
  readJson,
  respondentCookie,
  setSurveyCookie,
  undoCount,
} from "@/lib/http";

const HTTP_STATUS = {
  accepted: 201,
  completed: 201,
  closed: 409,
  duplicate: 409,
  invalid: 400,
  expired: 410,
  not_found: 404,
} as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ surveyId: string }> },
) {
  const { surveyId } = await ctx.params;
  if (!isId(surveyId)) return json({ status: "not_found" }, 404);
  if (req.cookies.has(hostCookie(surveyId)))
    return json({ status: "host" }, 403);
  const body = await readJson(req);
  if (!body) return json({ status: "invalid" }, 400);
  // 同じ回線からの回答は 1 時間に RESPONSE_LIMIT 件まで。受け付けなかった送信（重複・締め切りなど）は数えない
  //（学校や会社の回線で、同じ診断に答える友達が締め出されないように）
  const ip = clientIp(req);
  const rejectScope = `reject:${surveyId}`;
  if (await isLimited(ip, rejectScope, Date.now(), REJECT_LIMIT))
    return json({ status: "rate_limited" }, 429);
  if (!(await allowResponse(ip, surveyId, Date.now(), RESPONSE_LIMIT)))
    return json({ status: "rate_limited" }, 429);
  const name = respondentCookie(surveyId);
  const key = req.cookies.get(name)?.value ?? newId();
  const r = await submitResponse(
    surveyId,
    { answers: body.answers, relation: body.relation },
    key,
    new Date(),
    // どの送り方で届いた招待リンクから答えたか（計測の内訳。§11.11）
    isOrigin(body.from) ? body.from : "none",
  );
  if (r.status !== "accepted" && r.status !== "completed") {
    await undoCount(ip, surveyId);
    // 受け付けなかった送信は、別に数える（REJECT_LIMIT）
    await allowResponse(ip, rejectScope, Date.now(), REJECT_LIMIT);
  }
  if (r.status === "completed") await afterResponse(notifyCompleted(surveyId));
  const res = json(r, HTTP_STATUS[r.status]);
  setSurveyCookie(res, name, key, surveyId);
  return res;
}

// 「全員そろった」の通知（§11.10）。Cloudflare では返事を返したあとに送り、最後の回答者を待たせない
async function afterResponse(task: Promise<unknown>): Promise<void> {
  const safe = task.catch(() => {});
  if (isCloudflareWorkers()) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    getCloudflareContext().ctx.waitUntil(safe);
    return;
  }
  await safe;
}
