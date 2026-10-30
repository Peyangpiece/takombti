import type { NextRequest } from "next/server";
import { cleanup } from "@/lib/surveys";
import { cleanupInquiries, secretMatches } from "@/lib/inquiries";
import {
  allowResponse,
  cleanupRateLimits,
  clientIp,
  isLimited,
  json,
} from "@/lib/http";
import { cleanupVisits } from "@/lib/visits";
import { cleanupAdminAuth } from "@/lib/passkeys";
import { cleanupSupport } from "@/lib/supportStats";
import { cleanupFunnel } from "@/lib/funnel";

// 合言葉として十分な長さ。これより短い CRON_SECRET は、動かし続けたまま記録に注意を残す（§8.6）
const CRON_SECRET_MIN = 32;
let warnedShort = false;

// 1 日 1 回の定時処理（仕様書 §5.2）。CRON_SECRET を知っている呼び出しだけ受け付ける。
// 運営者の合言葉と同じく、まちがいが続く回線は 1 時間止め、止めている間は確かめもしない（総当たりを防ぐ）
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (await isLimited(ip, "cron-failure"))
    return json({ error: "rate_limited" }, 429);
  const auth = req.headers.get("authorization");
  const given = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const secret = process.env.CRON_SECRET;
  if (!secretMatches(given, secret)) {
    await allowResponse(ip, "cron-failure");
    return json({ error: "unauthorized" }, 401);
  }
  if (secret && secret.length < CRON_SECRET_MIN && !warnedShort) {
    warnedShort = true;
    console.warn(
      `cron: CRON_SECRET が ${CRON_SECRET_MIN} 文字より短いです。長い乱数に替えてください`,
    );
  }
  // 片付けは 1 つずつ別に行う（1 つが失敗しても、ほかは進める）。どれかが失敗したら 500 を返し、記録に残す
  const steps = {
    surveys: () => cleanup(),
    inquiries: () => cleanupInquiries(),
    visits: () => cleanupVisits(),
    adminAuth: () => cleanupAdminAuth(),
    support: () => cleanupSupport(),
    funnel: () => cleanupFunnel(),
    rateLimits: () => cleanupRateLimits(),
  };
  const out: Record<string, unknown> = {};
  const failed: string[] = [];
  for (const [name, run] of Object.entries(steps)) {
    try {
      out[name] = await run();
    } catch (e) {
      failed.push(name);
      console.error(`cleanup: ${name} が失敗しました`, e);
    }
  }
  return json({ ...out, failed }, failed.length > 0 ? 500 : 200);
}
