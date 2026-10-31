import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 招待・公開のページは noindex を付けて検索に載せない（仕様書 §8.6）。
// X などのリンクの見出しを作る仕組みは robots.txt に従うので、/a/・/r/・/api/og は閉じない
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/h",
        "/api/host",
        "/api/surveys",
        "/api/groups",
        "/api/cron",
        "/api/admin",
        "/api/visit",
        "/api/stripe",
        "/api/fortune",
        "/api/health",
        "/admin",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
