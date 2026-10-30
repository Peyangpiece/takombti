// Cloudflare Workers の入口（worker.ts）で、アプリに渡す前に見る決まり。
// - http:// で来たら https:// へ移す（回答や管理用リンクの通信を暗号化するため）
// - よそのサイトから送られてきた書き込み（POST など）を断る。
//   よそのサイトのページが、見ている人のブラウザを使って回答や問い合わせを送らせるのを防ぐ
// - 本文のある書き込みは JSON（application/json）だけを受ける

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// JSON でなくてよい書き込み（Stripe からの知らせ）
const JSON_EXEMPT = new Set(["/api/stripe/webhook"]);

function visitorScheme(request: Request): string | null {
  try {
    const v = JSON.parse(request.headers.get("cf-visitor") ?? "null") as {
      scheme?: unknown;
    } | null;
    if (typeof v?.scheme === "string") return v.scheme;
  } catch {
    // 形がおかしければ使わない
  }
  return request.headers.get("x-forwarded-proto");
}

function hostOf(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

export function guardRequest(request: Request): Response | null {
  const url = new URL(request.url);
  // 利用者のブラウザが http で来たかは、Cloudflare が付ける CF-Visitor（{"scheme":"http"}）か
  // X-Forwarded-Proto で見る。URL の形だけで決めると、手元の動作確認（wrangler dev）などで
  // https に移し続ける輪になりうるため。どちらの見出しもなければ移さない
  if (visitorScheme(request) === "http") {
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  if (url.pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method)) {
    // ブラウザが付ける Sec-Fetch-Site を見る。通すのは、同じサイトのページから（same-origin）と、
    // 人がアドレスを打ったなど、どのページからでもない（none）ものだけ。
    // same-site（同じドメインのほかの名前）・cross-site（よそのサイト）は断る。
    // 古いブラウザで付かないときは Origin の名前（ホスト）を比べる（http と https のちがいでは断らない）。
    // どちらもないとき（ブラウザではない呼び出し）は通す
    const site = request.headers.get("sec-fetch-site");
    const origin = request.headers.get("origin");
    const crossSite = site
      ? site !== "same-origin" && site !== "none"
      : origin !== null && hostOf(origin) !== url.host;
    if (crossSite) return refuse(403, "forbidden");
    // 本文のある書き込みは、JSON と名乗るものだけを受ける。よそのサイトのフォームや、
    // 下準備の問い合わせ（preflight）なしで送れる形（text/plain など）では送れないようにするため（§8.4）。
    // Stripe からの知らせは Stripe の形で届くので除く。定時処理（/api/cron）は読み取り（GET）なので当たらない
    if (!JSON_EXEMPT.has(url.pathname)) {
      const type = request.headers.get("content-type");
      const hasBody =
        Number(request.headers.get("content-length") ?? 0) > 0 ||
        request.headers.has("transfer-encoding");
      if ((type !== null || hasBody) && !isJsonType(type))
        return refuse(415, "unsupported_media_type");
    }
  }
  return null;
}

function refuse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function isJsonType(type: string | null): boolean {
  return (type ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}
