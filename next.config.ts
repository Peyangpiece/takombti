import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default nextConfig;
