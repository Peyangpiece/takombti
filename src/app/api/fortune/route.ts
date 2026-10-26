import type { NextRequest } from "next/server";
import { allowResponse, clientIp, isLimited, json, readJson } from "@/lib/http";
import { fortuneByCode } from "@/lib/fortune";

// 裏の占い：合言葉を受け取って、今日の占いを返す（仕様書 §4.11）。
// まちがいが同じ回線から 10 回続いたら 1 時間止める（止めている間は確かめもしない）
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isLimited(ip, "fortune-failure"))
    return json({ error: "rate_limited" }, 429);
  const body = await readJson(req);
  const fortune = await fortuneByCode(body?.code);
  if (!fortune) {
    allowResponse(ip, "fortune-failure");
    return json({ error: "not_found" }, 404);
  }
  return json({ fortune });
}
