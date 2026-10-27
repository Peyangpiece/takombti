// 流入から診断の完成までの計測（仕様書 §11.11）。
// 1. 出来事の件数（funnel_counts）：日・出来事・内訳・テストかどうかごとの合計だけ。だれの・どの診断かは残さない
// 2. 診断ごとの記録（survey_stats）：作った日時・流入元・入口・人数と、最初の回答・完成・結果の表示・公開の日時。
//    行の ID は診断の ID とは別の乱数で、診断からだけたどれる（surveys.stats_id）。診断を消すと、どの診断の記録かは
//    分からなくなり、件数としてだけ残る。呼び名・回答・管理用の鍵は入れない
// 作成・回答・完成など、サーバーの処理の成功で決まる出来事は、サーバーでその処理と同じトランザクションの中で数える。
// 完成・結果の表示・公開は、診断ごとに最初の 1 回だけ数える（再読み込みや送り直しで二重に数えない）

import { randomBytes } from "node:crypto";
import { getDb, type Queryable } from "./db";
import { jstDay } from "./visits";
import {
  CLIENT_EVENTS,
  ENTRIES,
  ORIGINS,
  type Entry,
  type Origin,
  type ServerEvent,
} from "../data/funnel";

export const KEEP_FUNNEL_DAYS = 400;
const DAY = 24 * 60 * 60 * 1000;
const JST = 9 * 60 * 60 * 1000;

export interface CreateContext {
  origin: Origin;
  campaign: string | null;
  entry: Entry;
  test: boolean;
}

export async function countEvent(
  q: Queryable,
  event: string,
  key: string,
  test: boolean,
  now = new Date(),
): Promise<void> {
  await q.query(
    `insert into funnel_counts (day, event, key, test, count) values ($1, $2, $3, $4, 1)
     on conflict (day, event, key, test) do update set count = funnel_counts.count + 1`,
    [jstDay(now), event, key, test],
  );
}

// 診断を作ったとき（同じトランザクションの中で呼ぶ）
export async function recordCreated(
  q: Queryable,
  surveyId: string,
  targetCount: number,
  ctx: CreateContext,
  now = new Date(),
): Promise<void> {
  const id = randomBytes(12).toString("base64url");
  await q.query(
    `insert into survey_stats (id, created_at, origin, campaign, entry, test, target_count)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, now, ctx.origin, ctx.campaign, ctx.entry, ctx.test, targetCount],
  );
  await q.query(`update surveys set stats_id = $2 where id = $1`, [
    surveyId,
    id,
  ]);
  await countEvent(q, "created", ctx.origin, ctx.test, now);
}

const COLUMN: Record<
  Exclude<ServerEvent, "created" | "response">,
  "completed_at" | "result_viewed_at" | "shared_at"
> = {
  completed: "completed_at",
  result_view: "result_viewed_at",
  public_created: "shared_at",
};

// 診断ごとに最初の 1 回だけの出来事。初めてなら日時を付けて件数に足し、true を返す
export async function markFirst(
  q: Queryable,
  surveyId: string,
  event: Exclude<ServerEvent, "created" | "response">,
  now = new Date(),
): Promise<boolean> {
  const col = COLUMN[event];
  const { rows } = await q.query<{ origin: string; test: boolean }>(
    `update survey_stats set ${col} = $2
      where id = (select stats_id from surveys where id = $1) and ${col} is null
      returning origin, test`,
    [surveyId, now],
  );
  if (rows.length === 0) return false;
  await countEvent(q, event, rows[0].origin, rows[0].test, now);
  return true;
}

// 回答を受け付けたとき。内訳は回答者がどの送り方で来たか。最初の回答の日時も付ける
export async function recordResponse(
  q: Queryable,
  surveyId: string,
  from: Origin,
  now = new Date(),
): Promise<void> {
  const { rows } = await q.query<{ test: boolean }>(
    `update survey_stats set first_response_at = coalesce(first_response_at, $2)
      where id = (select stats_id from surveys where id = $1)
      returning test`,
    [surveyId, now],
  );
  await countEvent(q, "response", from, rows[0]?.test ?? false, now);
}

// 運営者が、診断をテストとして集計から外す（または戻す）
export async function setStatsTest(
  surveyId: string,
  test: boolean,
): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(
    `update survey_stats set test = $2
      where id = (select stats_id from surveys where id = $1) returning id`,
    [surveyId, test],
  );
  return rows.length > 0;
}

// ---------- 集計（/admin） ----------

interface StatRow {
  created_at: Date | string;
  origin: string;
  entry: string;
  campaign: string | null;
  target_count: number;
  first_response_at: Date | string | null;
  completed_at: Date | string | null;
  result_viewed_at: Date | string | null;
  shared_at: Date | string | null;
}

const ms = (v: Date | string | null): number | null =>
  v === null ? null : new Date(v).getTime();

// 日本時間の週のはじめ（月曜）の日付
export function jstWeek(t: number): string {
  const d = new Date(t + JST);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
}

export interface Rate {
  // 分母：作ってから 24 時間（7 日）たった診断。まだたっていない診断は入れない
  eligible: number;
  done: number;
}

export interface CohortRow {
  week: string; // 作った週（月曜の日付）
  created: number;
  within24h: Rate;
  within7d: Rate;
  // 作ってから最初の回答までの時間（時間。中央値）。回答がまだない診断は入れない
  firstResponseHours: number | null;
  threePeople: number; // 人数 3 人で作った診断の数
}

export interface GroupRow {
  id: string;
  created: number;
  within7d: Rate;
  completed: number;
}

export interface FunnelSummary {
  includeTests: boolean;
  // 主な指標：週ごとの完成した診断の数（完成した週で数える）
  weeklyCompleted: { week: string; count: number }[];
  // 週ごとの出来事の件数
  weekly: { week: string; counts: Record<string, number> }[];
  // 最近 30 日の、出来事ごと・内訳ごとの件数
  byKey: Record<string, Record<string, number>>;
  cohorts: CohortRow[];
  byEntry: GroupRow[];
  byOrigin: GroupRow[];
  byCampaign: GroupRow[];
}

function rate(rows: StatRow[], hours: number, now: number): Rate {
  const span = hours * 60 * 60 * 1000;
  const eligible = rows.filter((r) => ms(r.created_at)! + span <= now);
  const done = eligible.filter((r) => {
    const c = ms(r.completed_at);
    return c !== null && c - ms(r.created_at)! <= span;
  });
  return { eligible: eligible.length, done: done.length };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function group(
  rows: StatRow[],
  keyOf: (r: StatRow) => string | null,
  ids: readonly string[],
  now: number,
): GroupRow[] {
  return ids
    .map((id) => {
      const list = rows.filter((r) => keyOf(r) === id);
      return {
        id,
        created: list.length,
        within7d: rate(list, 24 * 7, now),
        completed: list.filter((r) => r.completed_at !== null).length,
      };
    })
    .filter((g) => g.created > 0);
}

export async function summarizeFunnel(
  { includeTests = false, weeks = 8 } = {},
  nowDate = new Date(),
): Promise<FunnelSummary> {
  const db = await getDb();
  const now = nowDate.getTime();
  const weekList: string[] = [];
  for (let i = weeks - 1; i >= 0; i--)
    weekList.push(jstWeek(now - i * 7 * DAY));
  const fromDay = weekList[0];
  const fromTime = new Date(`${fromDay}T00:00:00+09:00`);
  const testFilter = includeTests ? "" : " and test = false";

  const { rows: stats } = await db.query<StatRow>(
    `select created_at, origin, entry, campaign, target_count, first_response_at,
            completed_at, result_viewed_at, shared_at
       from survey_stats
      where (created_at >= $1 or completed_at >= $1)${testFilter}`,
    [fromTime],
  );
  const { rows: counts } = await db.query<{
    day: string | Date;
    event: string;
    key: string;
    total: string | number;
  }>(
    `select day, event, key, sum(count) as total from funnel_counts
      where day >= $1${testFilter} group by day, event, key`,
    [fromDay],
  );

  const weeklyCompleted = weekList.map((week) => ({
    week,
    count: stats.filter(
      (r) => r.completed_at !== null && jstWeek(ms(r.completed_at)!) === week,
    ).length,
  }));

  const dayStr = (d: string | Date) =>
    typeof d === "string" ? d.slice(0, 10) : jstDay(new Date(d.getTime()));
  const weekly = weekList.map((week) => {
    const c: Record<string, number> = {};
    for (const r of counts) {
      const day = dayStr(r.day);
      if (jstWeek(new Date(`${day}T00:00:00+09:00`).getTime()) !== week)
        continue;
      c[r.event] = (c[r.event] ?? 0) + Number(r.total);
    }
    return { week, counts: c };
  });

  const since30 = jstDay(new Date(now - 29 * DAY));
  const byKey: Record<string, Record<string, number>> = {};
  for (const r of counts) {
    if (dayStr(r.day) < since30) continue;
    byKey[r.event] ??= {};
    byKey[r.event][r.key] = (byKey[r.event][r.key] ?? 0) + Number(r.total);
  }

  const created = stats.filter((r) => ms(r.created_at)! >= fromTime.getTime());
  const cohorts = weekList.map((week) => {
    const list = created.filter((r) => jstWeek(ms(r.created_at)!) === week);
    const firsts = list
      .filter((r) => r.first_response_at !== null)
      .map(
        (r) =>
          (ms(r.first_response_at)! - ms(r.created_at)!) / (60 * 60 * 1000),
      );
    const m = median(firsts);
    return {
      week,
      created: list.length,
      within24h: rate(list, 24, now),
      within7d: rate(list, 24 * 7, now),
      firstResponseHours: m === null ? null : Math.round(m * 10) / 10,
      threePeople: list.filter((r) => r.target_count === 3).length,
    };
  });

  return {
    includeTests,
    weeklyCompleted,
    weekly,
    byKey,
    cohorts,
    byEntry: group(
      created,
      (r) => r.entry,
      ENTRIES.map((e) => e.id),
      now,
    ),
    byOrigin: group(
      created,
      (r) => r.origin,
      ORIGINS.map((o) => o.id),
      now,
    ),
    byCampaign: group(
      created,
      (r) => r.campaign,
      [...new Set(created.map((r) => r.campaign).filter((c) => c !== null))],
      now,
    ),
  };
}

export async function cleanupFunnel(now = new Date()): Promise<number> {
  const db = await getDb();
  const limit = new Date(now.getTime() - KEEP_FUNNEL_DAYS * DAY);
  const a = await db.query(
    `delete from funnel_counts where day < $1 returning day`,
    [jstDay(limit)],
  );
  const b = await db.query(
    `delete from survey_stats where created_at < $1 returning id`,
    [limit],
  );
  return a.rows.length + b.rows.length;
}

// 画面から送られた出来事の件数（/api/event）
export async function recordClientEvent(
  event: keyof typeof CLIENT_EVENTS,
  key: string,
  test: boolean,
  now = new Date(),
): Promise<void> {
  const db = await getDb();
  await countEvent(db, event, key, test, now);
}
