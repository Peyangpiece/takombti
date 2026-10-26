// Cloudflare Workers の入口。OpenNext が作るアプリに、1 日 1 回の定時処理（Cron Trigger）を足す。
// 定時処理は、自分の /api/cron/cleanup を CRON_SECRET 付きで呼ぶ（仕様書 §5.2）
// @ts-expect-error ビルドのときに OpenNext が作るファイル
import handler from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
}

const worker = {
  fetch: handler.fetch,
  async scheduled(
    _event: unknown,
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    if (!env.CRON_SECRET) return;
    const req = new Request("https://cron.internal/api/cron/cleanup", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};

export default worker;
