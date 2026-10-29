import type { NextRequest } from "next/server";
import { isClientEvent } from "@/data/funnel";
import { allowEvent, clientIp, readJson } from "@/lib/http";
import { recordClientEvent } from "@/lib/funnel";
import { isBot } from "@/lib/visits";

// 画面での操作の件数（仕様書 §11.11）。決まった出来事と内訳だけを受け取り、日ごとの合計に足す。
// だれの・どの診断の操作かは受け取らない。数えられなくても画面には関係ないので、いつも 204 を返す
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const event = body?.event;
  const key = body?.key;
  if (
    isClientEvent(event, key) &&
    !isBot(req.headers.get("user-agent")) &&
    // 同じ回線からの数えすぎを防ぐ
    (await allowEvent(clientIp(req), `event:${event}`))
  ) {
    await recordClientEvent(event, String(key), body?.test === true).catch(
      () => {},
    );
  }
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
