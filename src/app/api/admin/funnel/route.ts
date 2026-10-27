import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { summarizeFunnel } from "@/lib/funnel";

// 流入から診断の完成までの集計（仕様書 §11.11）。?tests=1 でテストも含める
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const includeTests = req.nextUrl.searchParams.get("tests") === "1";
  return json(await summarizeFunnel({ includeTests }));
}
