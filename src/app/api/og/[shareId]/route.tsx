import type { NextRequest } from "next/server";
import { getShared } from "@/lib/surveys";
import { IMAGE_LIMIT, allowResponse, clientIp, isId, json } from "@/lib/http";
import { renderResultImage } from "@/lib/image";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await ctx.params;
  if (!isId(shareId)) return json({ error: "not_found" }, 404);
  // 1 枚ごとに描画するので、同じ回線からの枚数に上限を置く（公開リンクごと。§8.4）
  if (
    !(await allowResponse(
      clientIp(req),
      `og:${shareId}`,
      Date.now(),
      IMAGE_LIMIT,
    ))
  )
    return json({ error: "rate_limited" }, 429);
  const view = await getShared(shareId);
  if (!view) return json({ error: "not_found" }, 404);
  const size =
    req.nextUrl.searchParams.get("size") === "story" ? "story" : "wide";
  return renderResultImage(view, size);
}
