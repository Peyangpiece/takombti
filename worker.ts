// Cloudflare Workers の入口。OpenNext が作るアプリに、1 日 1 回の定時処理（Cron Trigger）を足す。
// 定時処理は、自分の /api/cron/cleanup を CRON_SECRET 付きで呼ぶ（仕様書 §5.2）。
// アプリに渡す前に、http:// の移し替えと、よそのサイトからの書き込みの拒否をする（src/lib/guard.ts）
// @ts-expect-error ビルドのときに OpenNext が作るファイル
import handler from "./.open-next/worker.js";
import { guardRequest } from "./src/lib/guard";

interface Env {
  CRON_SECRET?: string;
}

const worker = {
  fetch(request: Request, env: Env, ctx: unknown) {
    return guardRequest(request) ?? handler.fetch(request, env, ctx);
  },
  async scheduled(
    _event: unknown,
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    // 失敗しても黙って終わると、保存期限を過ぎたデータが消えないことに気づけない。
    // 記録（Workers Logs）に残し、例外にして Cron の実行結果も「失敗」にする
    if (!env.CRON_SECRET) {
      console.error(
        "cron: CRON_SECRET が設定されていないため、定時処理をしませんでした",
      );
      throw new Error("CRON_SECRET is not set");
    }
    const req = new Request("https://cron.internal/api/cron/cleanup", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const run = (async () => {
      const res: Response = await handler.fetch(req, env, ctx);
      const body = await res.text();
      if (!res.ok) {
        console.error(`cron: 定時処理が失敗しました（${res.status}） ${body}`);
        throw new Error(`cleanup failed: ${res.status}`);
      }
      console.log(`cron: ${body}`);
    })();
    ctx.waitUntil(run);
    await run;
  },
};

export default worker;
