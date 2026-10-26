import type { NextRequest } from "next/server";
import { createSurvey } from "@/lib/surveys";
import { COOKIE_MAX_AGE, hostCookie, json, readJson } from "@/lib/http";

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body) return json({ error: "bad_request" }, 400);
  const r = await createSurvey({
    nickname: body.nickname,
    targetCount: body.targetCount,
  });
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
