import type { NextRequest } from "next/server";
import { joinGroup } from "@/lib/groups";
import { isCampaign, isOrigin } from "@/data/funnel";
import {
  RESPONSE_LIMIT,
  allowResponse,
  clientIp,
  hostCookie,
  isId,
  json,
  readJson,
  setSurveyCookie,
} from "@/lib/http";

const HTTP_STATUS = {
  ok: 201,
  not_found: 404,
  closed: 409,
  expired: 410,
  duplicate_name: 409,
  empty: 400,
  too_long: 400,
  ng_word: 400,
} as const;

// グループに参加する（仕様書 §4.16）。呼び名を確かめ、その人の診断の管理用の鍵を作って、このときだけ平文で返す。
// 決めた人数がそろったら、その場で全員の診断を作る
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await ctx.params;
  if (!isId(groupId)) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  if (!body) return json({ status: "bad_request" }, 400);
  // 同じ回線からの参加は 1 時間に 20 件まで（学校などで、同じ回線の友達がいっしょに参加できるよう、作成より多め）
  if (
    !(await allowResponse(
      clientIp(req),
      "group-join",
      Date.now(),
      RESPONSE_LIMIT,
    ))
  )
    return json({ status: "rate_limited" }, 429);
  const r = await joinGroup(groupId, { nickname: body.nickname }, new Date(), {
    origin: isOrigin(body.origin) ? body.origin : "none",
    campaign: isCampaign(body.campaign) ? body.campaign : null,
    entry: "group",
    test: body.test === true,
  });
  const res = json(
    r.status === "ok" ? { status: "ok", hostKey: r.hostKey } : r,
    HTTP_STATUS[r.status],
  );
  // この参加で始まったら、自分の診断に答えられないよう、この端末にホストの印を付ける
  if (r.status === "ok" && r.surveyId)
    setSurveyCookie(res, hostCookie(r.surveyId), "1", r.surveyId);
  return res;
}
