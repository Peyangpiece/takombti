import type { NextRequest } from "next/server";
import { cleanup } from "@/lib/surveys";
import { cleanupInquiries, secretMatches } from "@/lib/inquiries";
import { json } from "@/lib/http";

// 1 日 1 回の定時処理（仕様書 §5.2）。CRON_SECRET を知っている呼び出しだけ受け付ける
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const given = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!secretMatches(given, process.env.CRON_SECRET)) {
    return json({ error: "unauthorized" }, 401);
  }
  const surveys = await cleanup();
  const inquiries = await cleanupInquiries();
  return json({ ...surveys, inquiries });
}
