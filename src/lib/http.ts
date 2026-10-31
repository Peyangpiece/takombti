// API の共通部品。
import { createHmac, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "./db";

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

// グループ診断を作った人の鍵（締め切って始めるため。§4.16）。管理用の鍵と同じく見出しで受け取る
export function adminKeyOf(req: NextRequest): string | null {
  const key = req.headers.get("x-admin-key");
  return key && /^[A-Za-z0-9_-]{16,64}$/.test(key) ? key : null;
}

// 本文の大きさの上限。回答（32 個の数）・呼び名・問い合わせ（2,000 文字）はこれで十分に収まる。
// 上限がないと、回数の制限にかかる前に巨大な JSON を読まされ、CPU と記憶領域を使わされるため（§8.4）
export const BODY_MAX_BYTES = 16 * 1024;

// 本文を、決めた大きさ（バイト数）までだけ読む。こえたら読むのをやめて null を返す。
// Content-Length は送らないこともできる（分けて送る形）ので、宣言だけに頼らず、実際に読んだ量を数える
export async function readTextLimited(
  req: Request,
  max: number,
): Promise<string | null> {
  const declared = req.headers.get("content-length");
  if (declared !== null && !(Number(declared) <= max)) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const buf = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    buf.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

// 本文が JSON と名乗っているか（Content-Type: application/json。charset などの付け足しは見ない）。
// よそのサイトのフォームは application/json を送れないので、書き込みの API はこれを求める（§8.4）
export function isJsonType(contentType: string | null): boolean {
  return (
    (contentType ?? "").split(";")[0].trim().toLowerCase() ===
    "application/json"
  );
}

export async function readJson(
  req: NextRequest,
): Promise<Record<string, unknown> | null> {
  try {
    if (!isJsonType(req.headers.get("content-type"))) return null;
    const text = await readTextLimited(req, BODY_MAX_BYTES);
    if (text === null) return null;
    const body = JSON.parse(text) as unknown;
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

// 診断ごとの cookie を、その診断の API（/api/surveys/<ID>）にだけ送られるように付ける。
// 前は path=/ で付けていて、どのページを開いても、その端末が作った診断・答えた診断の一覧が送られていた。
// 古い path=/ の cookie は、同じ値で付け直したうえで消す
export function setSurveyCookie(
  res: NextResponse,
  name: string,
  value: string,
  surveyId: string,
): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${name}=${value}; Path=/api/surveys/${surveyId}; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`,
  );
  res.headers.append(
    "Set-Cookie",
    `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
  );
}

// 回数の制限（仕様書 §8.4）。同じ回線から、決まった種類の操作を 1 時間に決まった回数まで。
// 数はデータベースで数える（Cloudflare では処理を受け持つ isolate がいくつもあり、記憶の中で数えると台数の分だけゆるくなるため）。
// IP アドレスそのものは保存せず、操作の種類と合わせて鍵付きのハッシュ値（HMAC）にしたものだけを持ち、1 時間を過ぎた記録は消す。
// IPv6 は利用者ごとに /64 の範囲をもらうことが多く、その中でいくらでもアドレスを変えられるので、/64 でまとめて数える
const WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMIT = 10;
// 同じ診断への回答は、同じ回線から 1 時間に 20 件まで（受け付けた回答だけ数える）。
// 学校・会社・携帯電話の回線は多くの人で同じアドレスを使うので、ほかの操作より多めにする
export const RESPONSE_LIMIT = 20;
// 受け付けなかった回答（重複・締め切り・形のまちがい）は、上とは別に 1 時間に 60 件まで。
// 受け付けた分だけを数えると、拒否される送信を同じ診断に無限に投げられ、その診断の行の鍵を取り合う処理を
// 回され続けるため（§8.4）。上限は友達が誤って送り直す数より十分に大きくする
export const REJECT_LIMIT = 60;
// 結果の画像（シェア画像・公開リンクの見出し画像）は 1 枚ごとに描画するので、同じ回線から 1 時間に 120 枚まで
export const IMAGE_LIMIT = 120;

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

// IPv6 の /64（先頭の 4 つの区切り）。省略の「::」を広げてから取り出す
export function ipKeyPart(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = ip.includes("::")
    ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t]
    : h;
  return `${full.slice(0, 4).join(":")}::/64`;
}

// 回線と操作の種類から、記録の名前を作る。サーバーだけが知る鍵を使った HMAC にする。
// 鍵のないハッシュ値だと、IPv4 の 43 億通りを試せば元のアドレスが分かり、
// 「どの回線がどの診断に答えたか」を記録から結びつけられてしまうため（§8.4）。
// 鍵は、すでに設定してある合言葉から作る（新しい設定はいらない）。どれもないときは、
// 手元の動作確認とテストでは起動ごとの乱数、本番では決まった値にして記録に注意を残す
let rateKey: { secret: string; key: Buffer } | null = null;
let devSecret: string | null = null;

function rateLimitKey(): Buffer {
  let secret =
    process.env.RATE_LIMIT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.ADMIN_TOKEN;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      if (!rateKey)
        console.warn(
          "rate-limit: RATE_LIMIT_SECRET・CRON_SECRET・ADMIN_TOKEN のどれもないため、決まった鍵で数えます",
        );
      secret = "takoshin-rate-limit-fallback";
    } else {
      devSecret ??= randomBytes(32).toString("hex");
      secret = devSecret;
    }
  }
  if (rateKey?.secret !== secret)
    rateKey = {
      secret,
      key: createHmac("sha256", secret).update("takoshin-rate-limit").digest(),
    };
  return rateKey.key;
}

export function keyOf(ip: string, scope: string): string {
  return createHmac("sha256", rateLimitKey())
    .update(`${ipKeyPart(ip)}|${scope}`)
    .digest("hex");
}

// 数えずに、もう上限に達しているかだけを見る（運営者の合言葉のまちがいを、確かめる前に止めるため）
export async function isLimited(
  ip: string,
  scope: string,
  now = Date.now(),
  limit = RATE_LIMIT,
): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query<{ count: number }>(
    `select count from rate_limits where key = $1 and window_start > $2`,
    [keyOf(ip, scope), new Date(now - WINDOW_MS)],
  );
  return rows.length > 0 && Number(rows[0].count) >= limit;
}

// 1 回数えて、上限の中なら true。1 時間ごとに数え直す（最初に数えた時から 1 時間）
export async function allowResponse(
  ip: string,
  scope: string,
  now = Date.now(),
  limit = RATE_LIMIT,
): Promise<boolean> {
  const db = await getDb();
  const at = new Date(now);
  const { rows } = await db.query<{ count: number }>(
    `insert into rate_limits (key, window_start, count) values ($1, $2, 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start <= $3 then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start <= $3 then $2 else rate_limits.window_start end
     returning count`,
    [keyOf(ip, scope), at, new Date(now - WINDOW_MS)],
  );
  // ときどき、1 時間を過ぎた記録を消す（定時処理でも消す）
  if (Math.random() < 0.01) await cleanupRateLimits(now);
  return Number(rows[0].count) <= limit;
}

// 数えた 1 回を取り消す（受け付けなかった回答を数えないため。同じ回線の友達が締め出されないように）
export async function undoCount(ip: string, scope: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `update rate_limits set count = greatest(count - 1, 0) where key = $1`,
    [keyOf(ip, scope)],
  );
}

export async function cleanupRateLimits(now = Date.now()): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ key: string }>(
    `delete from rate_limits where window_start <= $1 returning key`,
    [new Date(now - WINDOW_MS)],
  );
  return rows.length;
}

// 画面での操作の件数（§11.11）は、同じ回線から出来事ごとに 1 時間に 60 件まで。
// 携帯電話の回線は多くの人で同じアドレスを使うことがあるので、回答より多めにする
export const EVENT_LIMIT = 60;

export function allowEvent(ip: string, scope: string, now = Date.now()) {
  return allowResponse(ip, scope, now, EVENT_LIMIT);
}
