import type { NextRequest } from "next/server";
import { getHost, toShared } from "@/lib/surveys";
import {
  IMAGE_LIMIT,
  allowResponse,
  clientIp,
  hostKeyOf,
  json,
} from "@/lib/http";
import { renderResultImage } from "@/lib/image";
import { shareableSelfType } from "@/lib/scoring";

export async function GET(req: NextRequest) {
  const key = hostKeyOf(req);
  const host = key ? await getHost(key) : null;
  if (!host?.result) return json({ error: "not_found" }, 404);
  // 1 枚ごとに描画するので、同じ回線からの枚数に上限を置く（§8.4）
  if (!(await allowResponse(clientIp(req), "image", Date.now(), IMAGE_LIMIT)))
    return json({ error: "rate_limited" }, 429);
  const size =
    req.nextUrl.searchParams.get("size") === "wide" ? "wide" : "story";
  // スペシャル版は、応援のお願いで「応援する」を押した診断・特典を開いた診断だけ（§4.11）
  const special = req.nextUrl.searchParams.get("special") === "1";
  if (special && !host.special) return json({ error: "not_special" }, 403);
  // サポーターの印は、特典を開いた（支払った）診断のスペシャル版だけ。金額は入れない
  const supporter = req.nextUrl.searchParams.get("supporter") === "1";
  if (supporter && !(special && host.premium))
    return json({ error: "not_supporter" }, 403);
  // 自分で思うタイプは、自分で答えていて、4 文字が決まりきるときだけ入れられる
  const selfType = shareableSelfType(host.result.self);
  const withSelf = req.nextUrl.searchParams.get("self") === "1";
  if (withSelf && !selfType) return json({ error: "no_self" }, 403);
  return renderResultImage(
    toShared(host.nickname, host.result),
    size,
    special,
    supporter,
    withSelf ? selfType : null,
  );
}
