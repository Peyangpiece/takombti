import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { summarizeSupport } from "@/lib/supportStats";

// 応援のお願いの集計（最近 7 日・30 日・すべて）
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const [week, month, all] = await Promise.all([
    summarizeSupport(7),
    summarizeSupport(30),
    summarizeSupport(null),
  ]);
  return json({ week, month, all });
}
