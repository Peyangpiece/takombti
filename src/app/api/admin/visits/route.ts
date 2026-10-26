import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { summarizeVisits } from "@/lib/visits";

// どの送り方で開かれたかの件数（最近 7 日と 30 日）
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const [week, month] = await Promise.all([
    summarizeVisits(7),
    summarizeVisits(30),
  ]);
  return json({ week, month });
}
