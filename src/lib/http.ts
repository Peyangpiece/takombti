// API の共通部品。
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// 招待リンク・公開リンクの ID の形（乱数を URL に使える文字にしたもの。§8.2）。
// 形のちがう値は、データベースに問い合わせる前に断る
export function isId(v: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(v);
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

// 接続してきた相手の IP アドレス。Cloudflare の上では、Cloudflare が付ける CF-Connecting-IP を使う
//（利用者が送ってきた同じ名前の見出しは Cloudflare が書き換えるので、偽れない）。
// X-Forwarded-For の先頭は利用者が好きな値を送れる（Cloudflare は後ろに足すだけ）ので、
// Cloudflare を通らない手元の動作確認のときだけ使う
export function clientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

function keyOf(ip: string, scope: string): string {
  return createHash("sha256").update(`${ip}|${scope}`).digest("hex");
}

// 数えずに、もう上限に達しているかだけを見る（運営者の合言葉のまちがいを、確かめる前に止めるため）
export function isLimited(
  ip: string,
  scope: string,
  now = Date.now(),
): boolean {
  const list = (hits.get(keyOf(ip, scope)) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );
  return list.length >= RATE_LIMIT;
}

export function allowResponse(
  ip: string,
  surveyId: string,
  now = Date.now(),
): boolean {
  const key = keyOf(ip, surveyId);
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
