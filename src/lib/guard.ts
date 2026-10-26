// Cloudflare Workers の入口（worker.ts）で、アプリに渡す前に見る決まり。
// - http:// で来たら https:// へ移す（回答や管理用リンクの通信を暗号化するため）
// - よそのサイトから送られてきた書き込み（POST など）を断る。
//   よそのサイトのページが、見ている人のブラウザを使って回答や問い合わせを送らせるのを防ぐ

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

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
    // ブラウザが付ける Sec-Fetch-Site を見る。古いブラウザで付かないときは Origin の名前（ホスト）を比べる
    //（http と https のちがいでは断らない）
    const site = request.headers.get("sec-fetch-site");
    const crossSite = site
      ? site === "cross-site"
      : hostOf(request.headers.get("origin")) !== url.host &&
        request.headers.get("origin") !== null;
    if (crossSite) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }
  }
  return null;
}
