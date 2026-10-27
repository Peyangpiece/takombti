// Cloudflare Workers で動かすための設定（OpenNext）。
// 公開の前に作っておけるページ（トップ・16 タイプの紹介・規約など）は、作ったものを Workers の静的ファイルから返す
//（毎回作り直さないので速い）。あとから作り直す設定（revalidate）は使っていないので、読むだけの置き場で足りる。
// 診断ごとのページと API は、これまでどおり毎回作る
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
