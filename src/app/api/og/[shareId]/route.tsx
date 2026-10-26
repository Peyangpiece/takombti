import type { NextRequest } from "next/server";
import { getShared } from "@/lib/surveys";
import { json } from "@/lib/http";
import { renderResultImage } from "@/lib/image";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await ctx.params;
  const view = await getShared(shareId);
  if (!view) return json({ error: "not_found" }, 404);
  const size =
    req.nextUrl.searchParams.get("size") === "story" ? "story" : "wide";
  return renderResultImage(view, size);
}
