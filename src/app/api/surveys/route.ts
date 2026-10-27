import type { NextRequest } from "next/server";
import { createSurvey } from "@/lib/surveys";
import { isCampaign, isEntry, isOrigin } from "@/data/funnel";
import {
  COOKIE_MAX_AGE,
  allowResponse,
  clientIp,
  hostCookie,
  json,
  readJson,
} from "@/lib/http";

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body) return json({ error: "bad_request" }, 400);
  // 同じ回線から作れる診断は 1 時間に 10 件まで（機械で大量に作られるのを防ぐ）
  if (!allowResponse(clientIp(req), "create"))
    return json({ error: "rate_limited" }, 429);
  // 計測のための入口・流入元（§11.11）。決まった値だけを受け付ける
  const r = await createSurvey(
    { nickname: body.nickname, targetCount: body.targetCount },
    new Date(),
    {
      origin: isOrigin(body.origin) ? body.origin : "none",
      campaign: isCampaign(body.campaign) ? body.campaign : null,
      entry: isEntry(body.entry) ? body.entry : "none",
      test: body.test === true,
    },
  );
  if (!r.ok) return json({ error: r.error }, 400);
  const res = json({ surveyId: r.surveyId, hostKey: r.hostKey }, 201);
  // この端末がホストであることだけを覚えておく（自分の診断に答えられないようにするため）
  res.cookies.set(hostCookie(r.surveyId), "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
