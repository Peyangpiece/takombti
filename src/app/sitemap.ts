import type { MetadataRoute } from "next";
import { TYPE_CODES } from "@/data/framework";
import { SITE_URL, typePath } from "@/lib/site";

// サイトの地図（検索エンジン向け）。だれでも見られるページだけを載せる。
// 招待・公開・管理のページ（/a/・/r/・/h）は載せない（仕様書 §8.6）
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({
    url: `${SITE_URL}${path}`,
    priority,
  });
  return [
    page("/", 1),
    page("/types", 0.8),
    ...TYPE_CODES.map((c) => page(typePath(c), 0.7)),
    page("/new", 0.5),
    page("/terms", 0.2),
    page("/privacy", 0.2),
    page("/legal", 0.2),
    page("/contact", 0.2),
  ];
}
