import { getDb, lastCleanupSuccess } from "@/lib/db";
import { json } from "@/lib/http";

// 定時処理（1 日 1 回）が、これより長く済んでいなければ異常とする（1 日 ＋ 遅れの余裕 2 時間）
const CLEANUP_STALE_MS = 26 * 60 * 60 * 1000;

// 動いているかの確かめ（外からの定期的な見回り。.github/workflows/healthcheck.yml）。
// データベースに、定時処理が最後にすべて済んだ日時だけを問い合わせる（§11.8）。
// まだ一度も済んでいない（入れたばかり）ときは確かめない。診断や回答の中身・件数は返さない
export async function GET() {
  try {
    const db = await getDb();
    const last = await lastCleanupSuccess(db);
    if (last && Date.now() - last.getTime() > CLEANUP_STALE_MS) {
      return json({ ok: false }, 503);
    }
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}
