import type { NextRequest } from "next/server";
import { isVisitPage, isVisitSource } from "@/data/sources";
import { allowResponse, clientIp, readJson } from "@/lib/http";
import { isBot, recordVisit } from "@/lib/visits";

// 招待リンク・公開リンクが開かれたときに、ページの種類と送り方だけを受け取って数える（仕様書 §8.1）。
// 数えられなくても画面には関係ないので、いつも 204 を返す
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const page = body?.page;
  const source = body?.from ?? "none";
  if (
    isVisitPage(page) &&
    isVisitSource(source) &&
    !(page === "top" && source === "none") &&
    !isBot(req.headers.get("user-agent")) &&
    // 同じ回線からの数えすぎを防ぐ（1 時間に 10 件まで）
    (await allowResponse(clientIp(req), `visit:${page}`))
  ) {
    await recordVisit(page, source).catch(() => {});
  }
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
