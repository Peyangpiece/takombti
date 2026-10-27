import { getDb } from "@/lib/db";
import { json } from "@/lib/http";

// 動いているかの確かめ（外からの定期的な見回り。.github/workflows/healthcheck.yml）。
// データベースに `select 1` だけを問い合わせる。診断や回答の中身・件数は返さない
export async function GET() {
  try {
    const db = await getDb();
    await db.query("select 1");
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}
