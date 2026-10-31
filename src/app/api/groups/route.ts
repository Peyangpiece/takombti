import type { NextRequest } from "next/server";
import { createGroup } from "@/lib/groups";
import { isCampaign, isOrigin } from "@/data/funnel";
import { allowResponse, clientIp, json, readJson } from "@/lib/http";

// グループ診断を作る（仕様書 §4.16）。作った人も最初のメンバーになる。
// 鍵（作った人の管理用の鍵・締め切って始めるための鍵）は、このときだけ平文で返す
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body) return json({ error: "bad_request" }, 400);
  // 同じ回線から作れるグループは 1 時間に 10 件まで（機械で大量に作られるのを防ぐ）
  if (!(await allowResponse(clientIp(req), "group-create")))
    return json({ error: "rate_limited" }, 429);
  const r = await createGroup(
    { nickname: body.nickname, size: body.size },
    new Date(),
    {
      origin: isOrigin(body.origin) ? body.origin : "none",
      campaign: isCampaign(body.campaign) ? body.campaign : null,
      entry: "group",
      test: body.test === true,
    },
  );
  if (!r.ok) return json({ error: r.error }, 400);
  return json(
    { groupId: r.groupId, hostKey: r.hostKey, adminKey: r.adminKey },
    201,
  );
}
