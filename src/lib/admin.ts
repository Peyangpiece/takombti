// 運営者用 API の共通部品。合言葉は X-Admin-Token 見出しで受け取る
import type { NextRequest } from "next/server";
import { isAdmin } from "./inquiries";
import { allowResponse, clientIp, isLimited, json } from "./http";

// 合言葉が合っていれば null、合わなければ断りの応答を返す。
// まちがいが続く回線は 1 時間止める。止めている間は合言葉を確かめもしない（総当たりで当てられないように）
export function requireAdmin(req: NextRequest) {
  const ip = clientIp(req);
  if (isLimited(ip, "admin-failure"))
    return json({ error: "rate_limited" }, 429);
  if (isAdmin(req.headers.get("x-admin-token"))) return null;
  allowResponse(ip, "admin-failure");
  return json({ error: "unauthorized" }, 401);
}
