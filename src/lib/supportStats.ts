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
    id = randomBytes(12).toString("base64url");
    await q.query(`insert into support_records (id, day) values ($1, $2)`, [
      id,
      jstDay(now),
    ]);
    await q.query(`update surveys set support_record_id = $2 where id = $1`, [
      surveyId,
      id,
    ]);
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
  return {
    days,
    seen: n("seen"),
    giftPaid: n("gift_paid"),
    giftUnpaid: n("gift_unpaid"),
    noGiftPaid: n("no_gift_paid"),
    noGiftUnpaid: n("no_gift_unpaid"),
    closed: n("closed"),
    checkoutUnpaid: n("checkout_unpaid"),
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
