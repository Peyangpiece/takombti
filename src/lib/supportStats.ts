// 応援のお願いの記録と集計（仕様書 §4.11）。
// 診断ごとに「応援のお願いを見た・応援するを押した・今回は閉じた・支払いのページを開いた・支払った」を 1 行に残し、
// /admin では「応援するを押したか × 支払ったか」の 4 通りの数だけを見せる。
// 行の ID は診断の ID とは別の乱数。診断を消すと、どの診断の記録かは分からなくなる

import { randomBytes } from "node:crypto";
import { getDb, type Queryable } from "./db";
import { jstDay } from "./visits";

export const KEEP_SUPPORT_DAYS = 400;
const DAY = 24 * 60 * 60 * 1000;

export type SupportEvent = "seen" | "gift" | "closed" | "checkout" | "paid";

const COLUMN: Record<Exclude<SupportEvent, "seen">, string> = {
  gift: "gift_at",
  closed: "closed_at",
  checkout: "checkout_at",
  paid: "paid_at",
};

// その診断の記録の行を作り（なければ）、出来事の日時を付ける（最初の 1 回だけ）。
// 応援のお願いを見たことは、行があることで表す
export async function recordSupport(
  q: Queryable,
  surveyId: string,
  event: SupportEvent,
  now = new Date(),
): Promise<void> {
  const { rows } = await q.query<{ support_record_id: string | null }>(
    `select support_record_id from surveys where id = $1`,
    [surveyId],
  );
  if (rows.length === 0) return;
  let id = rows[0].support_record_id;
  if (!id) {
    // 同時に 2 つ届いても行が 1 つになるよう、行を作ってから「まだなければ」診断に結びつける。
    // 先にほかの行が結びついていたら、作った行は消して、そちらを使う
    const fresh = randomBytes(12).toString("base64url");
    await q.query(`insert into support_records (id, day) values ($1, $2)`, [
      fresh,
      jstDay(now),
    ]);
    const linked = await q.query<{ support_record_id: string }>(
      `update surveys set support_record_id = coalesce(support_record_id, $2)
        where id = $1 returning support_record_id`,
      [surveyId, fresh],
    );
    id = linked.rows[0]?.support_record_id ?? fresh;
    if (id !== fresh)
      await q.query(`delete from support_records where id = $1`, [fresh]);
  }
  if (event === "seen") return;
  const col = COLUMN[event];
  await q.query(
    `update support_records set ${col} = coalesce(${col}, $2) where id = $1`,
    [id, now],
  );
}

export interface SupportSummary {
  days: number | null; // null はすべて（残っている 400 日分）
  seen: number; // 応援のお願いを見た診断
  giftPaid: number; // 1. 応援する → 支払った
  giftUnpaid: number; // 2. 応援する → 支払っていない
  noGiftPaid: number; // 3. 応援しない → 支払った
  noGiftUnpaid: number; // 4. 応援しない → 支払っていない
  closed: number; // 4 のうち「今回は閉じる」を押した
  checkoutUnpaid: number; // 支払いのページを開いたが、支払っていない
  amounts: { amount: number; count: number }[]; // 支払いの金額ごとの件数（支払った日で分ける）
  total: number; // 支払いの合計金額（円）
}

// 最初に応援のお願いを見た日（日本時間）が、今日を含む最近 days 日に入る診断の数
export async function summarizeSupport(
  days: number | null,
  now = new Date(),
): Promise<SupportSummary> {
  const db = await getDb();
  const from = days ? jstDay(new Date(now.getTime() - (days - 1) * DAY)) : null;
  const { rows } = await db.query<Record<string, string | number>>(
    `select
       count(*) as seen,
       count(*) filter (where gift_at is not null and paid_at is not null) as gift_paid,
       count(*) filter (where gift_at is not null and paid_at is null) as gift_unpaid,
       count(*) filter (where gift_at is null and paid_at is not null) as no_gift_paid,
       count(*) filter (where gift_at is null and paid_at is null) as no_gift_unpaid,
       count(*) filter (where gift_at is null and paid_at is null and closed_at is not null) as closed,
       count(*) filter (where checkout_at is not null and paid_at is null) as checkout_unpaid
     from support_records where ($1::date is null or day >= $1::date)`,
    [from],
  );
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  // 支払いは payments（診断を消しても残る）から、支払った日時で数える。全額を返金した・取り消された支払いは数えない
  const since = from ? new Date(`${from}T00:00:00+09:00`) : null;
  const paid = await db.query<{ amount: number; count: string | number }>(
    `select amount, count(*) as count from payments
      where refunded_at is null
        and ($1::timestamptz is null or created_at >= $1::timestamptz)
      group by amount order by amount`,
    [since],
  );
  const amounts = paid.rows.map((p) => ({
    amount: Number(p.amount),
    count: Number(p.count),
  }));
  return {
    days,
    seen: n("seen"),
    giftPaid: n("gift_paid"),
    giftUnpaid: n("gift_unpaid"),
    noGiftPaid: n("no_gift_paid"),
    noGiftUnpaid: n("no_gift_unpaid"),
    closed: n("closed"),
    checkoutUnpaid: n("checkout_unpaid"),
    amounts,
    total: amounts.reduce((sum, a) => sum + a.amount * a.count, 0),
  };
}

export async function cleanupSupport(now = new Date()): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from support_records where day < $1 returning id`,
    [jstDay(new Date(now.getTime() - KEEP_SUPPORT_DAYS * DAY))],
  );
  return rows.length;
}

// 応援の画面に出す「これまでに応援してくれた人数」。支払いの記録（payments。診断を消しても残る）の件数。
// 全額を返金した・取り消された支払いは数えない。
// 少ないうちは出さない（「まだ 2 人」と出ると、かえって応援しにくくなるため）
export const SHOW_SUPPORTERS_FROM = 20;

export async function supporterCount(
  min = SHOW_SUPPORTERS_FROM,
): Promise<number | null> {
  const db = await getDb();
  const { rows } = await db.query<{ n: string | number }>(
    `select count(*) as n from payments where refunded_at is null`,
  );
  const n = Number(rows[0]?.n ?? 0);
  return n >= min ? n : null;
}
