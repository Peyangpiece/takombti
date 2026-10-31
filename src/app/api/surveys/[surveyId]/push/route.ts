import type { NextRequest } from "next/server";
import {
  RESPONSE_LIMIT,
  allowResponse,
  clientIp,
  hostCookie,
  isId,
  json,
  readJson,
  respondentCookie,
} from "@/lib/http";
import {
  addRespondentSubscription,
  removeRespondentSubscription,
} from "@/lib/push";

const HTTP = {
  ok: 200,
  not_found: 404,
  not_open: 409,
  invalid: 400,
  full: 409,
  forbidden: 403,
} as const;

// 答えた友達が「結果が出たら知らせてもらう」（仕様書 §4.10・§11.10）。
// その診断に答えて受け付けられた人（回答者の鍵の cookie で確かめる）だけが登録できる。
// 同じ回線からは、診断ごとに 1 時間に RESPONSE_LIMIT 回まで（学校や会社の回線で、友達どうしが締め出されないよう回答と同じ数）
async function guard(
  req: NextRequest,
  surveyId: string,
): Promise<Response | null> {
  if (!isId(surveyId)) return json({ status: "not_found" }, 404);
  if (req.cookies.has(hostCookie(surveyId)))
    return json({ status: "forbidden" }, 403);
  if (
    !(await allowResponse(
      clientIp(req),
      `push:${surveyId}`,
      Date.now(),
      RESPONSE_LIMIT,
    ))
  )
    return json({ status: "rate_limited" }, 429);
  return null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ surveyId: string }> },
) {
  const { surveyId } = await ctx.params;
  const refused = await guard(req, surveyId);
  if (refused) return refused;
  const body = await readJson(req);
  if (!body) return json({ status: "invalid" }, 400);
  const status = await addRespondentSubscription(
    surveyId,
    req.cookies.get(respondentCookie(surveyId))?.value ?? null,
    body.subscription,
  );
  return json({ status }, HTTP[status]);
}

// 通知をやめる
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ surveyId: string }> },
) {
  const { surveyId } = await ctx.params;
  const refused = await guard(req, surveyId);
  if (refused) return refused;
  const body = await readJson(req);
  if (!body) return json({ status: "invalid" }, 400);
  const status = await removeRespondentSubscription(
    surveyId,
    req.cookies.get(respondentCookie(surveyId))?.value ?? null,
    body.endpoint,
  );
  return json({ status }, HTTP[status]);
}
