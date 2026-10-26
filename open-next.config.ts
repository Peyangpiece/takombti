// Cloudflare Workers で動かすための設定（OpenNext）。
// ページはほとんどが毎回作るものなので、ISR のキャッシュ（R2 など）は使わない
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
