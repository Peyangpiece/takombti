import type { NextRequest } from "next/server";
import { deleteSurvey, getHost } from "@/lib/surveys";
import { hostCookie, hostKeyOf, json, setSurveyCookie } from "@/lib/http";

export async function GET(req: NextRequest) {
  const key = hostKeyOf(req);
  const view = key ? await getHost(key) : null;
  if (!view) return json({ error: "not_found" }, 404);
  const res = json(view);
  // グループ診断（§4.15）の診断は、作った端末ではなく、始めたときに作られる。
  // 管理の画面を開いた端末にも、自分の診断に答えられないようホストの印を付ける
  if (view.groupId)
    setSurveyCookie(res, hostCookie(view.surveyId), "1", view.surveyId);
  return res;
}

export async function DELETE(req: NextRequest) {
  const key = hostKeyOf(req);
  const status = key ? await deleteSurvey(key) : "not_found";
  return json({ status }, status === "ok" ? 200 : 404);
}
