// API の共通部品。
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function hostKeyOf(req: NextRequest): string | null {
  const key = req.headers.get("x-host-key");
  return key && /^[A-Za-z0-9_-]{16,64}$/.test(key) ? key : null;
}

export async function readJson(
  req: NextRequest,
): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// 診断ごとの小さな記録（cookie）の名前。ID は URL に使える文字だけなので、そのまま名前に入れられる
export const hostCookie = (surveyId: string) => `tkh_${surveyId}`;
export const respondentCookie = (surveyId: string) => `tkr_${surveyId}`;
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

// 同じ回線から同じ診断への回答は 1 時間に 10 件まで（仕様書 §8.4）。
// IP アドレスは保存せず、ハッシュ値をこの処理の記憶の中に 1 時間だけ持つ。
// サーバーが複数台に分かれると台ごとの数になるので、目安としての制限である。
const WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMIT = 10;
const hits = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export function allowResponse(
  ip: string,
  surveyId: string,
  now = Date.now(),
): boolean {
  const key = createHash("sha256").update(`${ip}|${surveyId}`).digest("hex");
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 50_000) {
    for (const [k, v] of hits)
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return true;
}
