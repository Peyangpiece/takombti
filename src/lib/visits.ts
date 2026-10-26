// 招待リンク・公開リンクが、どの送り方で開かれたかの件数（仕様書 §8.1）。
// 日・ページの種類・送り方ごとの合計だけを持ち、だれが開いたか・どの診断かは残さない。

import { getDb } from "./db";
import {
  VISIT_PAGES,
  VISIT_SOURCES,
  type VisitPage,
  type VisitSource,
} from "../data/sources";

// 件数は 400 日で消す（1 年前の同じ時期と比べられるように）
export const KEEP_VISIT_DAYS = 400;
const DAY = 24 * 60 * 60 * 1000;
const JST = 9 * 60 * 60 * 1000;

// 日本時間の日付（YYYY-MM-DD）
export function jstDay(now: Date): string {
  return new Date(now.getTime() + JST).toISOString().slice(0, 10);
}

// 機械による読み込み（リンクの見出しを作る仕組み・検索エンジンなど）は数えない
const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|line-poker|headless|lighthouse/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

export async function recordVisit(
  page: VisitPage,
  source: VisitSource,
  now = new Date(),
): Promise<void> {
  const db = await getDb();
  await db.query(
    `insert into visit_counts (day, page, source, count) values ($1, $2, $3, 1)
     on conflict (day, page, source) do update set count = visit_counts.count + 1`,
    [jstDay(now), page, source],
  );
}

export interface VisitSummary {
  days: number;
  // counts[page][source] = 件数
  counts: Record<VisitPage, Record<VisitSource, number>>;
}

function emptyCounts(): VisitSummary["counts"] {
  return Object.fromEntries(
    VISIT_PAGES.map((p) => [
      p.id,
      Object.fromEntries(VISIT_SOURCES.map((s) => [s.id, 0])),
    ]),
  ) as VisitSummary["counts"];
}

// 今日を含む最近 days 日（日本時間）の合計
export async function summarizeVisits(
  days: number,
  now = new Date(),
): Promise<VisitSummary> {
  const db = await getDb();
  const from = jstDay(new Date(now.getTime() - (days - 1) * DAY));
  const { rows } = await db.query<{
    page: VisitPage;
    source: VisitSource;
    total: string | number;
  }>(
    `select page, source, sum(count) as total from visit_counts
     where day >= $1 group by page, source`,
    [from],
  );
  const counts = emptyCounts();
  for (const r of rows) {
    if (counts[r.page] && r.source in counts[r.page])
      counts[r.page][r.source] = Number(r.total);
  }
  return { days, counts };
}

export async function cleanupVisits(now = new Date()): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from visit_counts where day < $1 returning day`,
    [jstDay(new Date(now.getTime() - KEEP_VISIT_DAYS * DAY))],
  );
  return rows.length;
}
