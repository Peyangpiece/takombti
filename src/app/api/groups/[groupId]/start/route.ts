import type { NextRequest } from "next/server";
import { startGroup } from "@/lib/groups";
import {
  adminKeyOf,
  hostCookie,
  hostKeyOf,
  isId,
  json,
  setSurveyCookie,
} from "@/lib/http";

const HTTP_STATUS = {
  ok: 200,
  not_found: 404,
  forbidden: 403,
  not_enough: 409,
  closed: 409,
  expired: 410,
} as const;

// 作った人が、ここで締め切って始める（参加が 4 人以上のときだけ。仕様書 §4.16）。
// 作った人の鍵（X-Admin-Key）が必要。X-Host-Key は、作った人の診断にホストの印を付けるためだけに使う
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await ctx.params;
  if (!isId(groupId)) return json({ status: "not_found" }, 404);
  const adminKey = adminKeyOf(req);
  if (!adminKey) return json({ status: "forbidden" }, 403);
  const r = await startGroup(groupId, adminKey, hostKeyOf(req));
  const res = json({ status: r.status }, HTTP_STATUS[r.status]);
  if (r.status === "ok" && r.surveyId)
    setSurveyCookie(res, hostCookie(r.surveyId), "1", r.surveyId);
  return res;
}
