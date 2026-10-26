import type { NextConfig } from "next";

// 読み込んでよいものの範囲（Content-Security-Policy）。よそのサイトのスクリプト・通信・埋め込みを許さない。
// Next.js はページの中に小さなスクリプトと style を直接書くので、'unsafe-inline' は外せない。
// 開発用のサーバーは eval を使うので、本番だけで付ける
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // PGlite は WebAssembly を読み込むので、まとめずに Node から直接読む
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Cloudflare Workers では pg が pg-cloudflare（workerd 向けの接続部品）を読む。
  // Node での依存の追跡では空のファイルしか拾われないので、全体を含める
  outputFileTracingIncludes: { "/*": ["./node_modules/pg-cloudflare/**/*"] },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          // カメラ・マイク・位置情報は使わない
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(isProd
            ? [
                { key: "Content-Security-Policy", value: CSP },
                // 一度 https で開いたら、1 年間は http で開かない（daigakunote.com のほかの名前には広げない）
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
