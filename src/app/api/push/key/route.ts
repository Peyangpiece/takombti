import { json } from "@/lib/http";
import { vapidKeys } from "@/lib/push";

// 通知の購読に使う公開鍵（仕様書 §11.10）。秘密の鍵は返さない
export async function GET() {
  const { publicKey } = await vapidKeys();
  return json({ publicKey });
}
