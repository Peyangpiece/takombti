import type { NextRequest } from "next/server";
import { isCloudflareWorkers } from "@/lib/db";
import { notifyCompleted } from "@/lib/push";
import { isOrigin } from "@/data/funnel";
import { newId, submitResponse } from "@/lib/surveys";
import {
  COOKIE_MAX_AGE,
  allowResponse,
  clientIp,
  hostCookie,
  isId,
  json,
  readJson,
  respondentCookie,
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
  if (!allowResponse(clientIp(req), surveyId))
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
  if (r.status === "completed") await afterResponse(notifyCompleted(surveyId));
  const res = json(r, HTTP_STATUS[r.status]);
  res.cookies.set(name, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
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
