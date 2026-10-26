// 運営者用 API の共通部品。合言葉は X-Admin-Token 見出しで受け取る
import type { NextRequest } from "next/server";
import { isAdmin } from "./inquiries";
import { allowResponse, clientIp, json } from "./http";

// 合言葉が合っていれば null、合わなければ断りの応答を返す。まちがいが続く回線は 1 時間止める
export function requireAdmin(req: NextRequest) {
  const ip = clientIp(req);
  if (isAdmin(req.headers.get("x-admin-token"))) return null;
  if (!allowResponse(ip, "admin-failure"))
    return json({ error: "rate_limited" }, 429);
  return json({ error: "unauthorized" }, 401);
}
