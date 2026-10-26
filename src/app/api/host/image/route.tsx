import type { NextRequest } from "next/server";
import { getHost, toShared } from "@/lib/surveys";
import { hostKeyOf, json } from "@/lib/http";
import { renderResultImage } from "@/lib/image";

export async function GET(req: NextRequest) {
  const key = hostKeyOf(req);
  const host = key ? await getHost(key) : null;
  if (!host?.result) return json({ error: "not_found" }, 404);
  const size =
    req.nextUrl.searchParams.get("size") === "wide" ? "wide" : "story";
  // スペシャル版は、応援のお願いで「応援する」を押した診断・特典を開いた診断だけ（§4.11）
  const special = req.nextUrl.searchParams.get("special") === "1";
  if (special && !host.special) return json({ error: "not_special" }, 403);
  return renderResultImage(toShared(host.nickname, host.result), size, special);
}
