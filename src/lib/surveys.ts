// 診断の作成・回答の受付・結果の確定など（仕様書 §5・§11.2・§11.3）。
// 受付中の診断について、結果・途中の集計・個々の回答を返す関数は作らない。

import { createHash, randomBytes } from "node:crypto";
import { getDb, type Queryable } from "./db";
import { computeResult, validateAnswers, type Result } from "./scoring";
import { checkNickname, type NicknameError } from "./text";
import { RELATIONS } from "../data/framework";
import { QUESTION_VERSION } from "../data/questions";
import { detailedAnalysis, type DetailedAnalysis } from "./premium";
import { premiumOffer, type PremiumOffer } from "./stripe";

export const MIN_TARGET = 3;
export const MAX_TARGET = 30;
export const DEFAULT_TARGET = 5;
const DAY = 24 * 60 * 60 * 1000;
export const OPEN_DAYS = 30;
export const EXTEND_DAYS = 30;
// 結果が出たあとに人数をふやすときは、3 人以上ふやす（§5.4）。
// 1〜2 人だけだと、前の結果と新しい結果の差から、その人の答えの傾向が分かってしまうため
export const MIN_RAISE_AFTER_RESULT = 3;
export const KEEP_COMPLETED_DAYS = 180;
export const KEEP_EXPIRED_DAYS = 30;

export type Status = "open" | "completed" | "expired";

export function newId(): string {
  return randomBytes(16).toString("base64url");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

interface SurveyRow {
  id: string;
  nickname: string;
  target_count: number;
  response_count: number;
  status: Status;
  self_answers: number[] | null;
  extended: boolean;
  expires_at: Date;
  completed_at: Date | null;
  delete_at: Date | null;
  result: Result | string | null;
  share_id: string | null;
  question_version: number;
  premium_at?: Date | string | null;
  gift_at?: Date | string | null;
  fortune_code?: string | null;
}

function toDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}

function parseResult(v: Result | string | null): Result | null {
  if (v === null) return null;
  return typeof v === "string" ? (JSON.parse(v) as Result) : v;
}

// 受付中でも期限を過ぎていれば期限切れとして扱う（定時処理を待たない）。
// 古い版の問で作った診断は、今の問と混ぜられないので、受付中なら期限切れとして扱う
function effectiveStatus(row: SurveyRow, now: Date): Status {
  if (
    row.status === "open" &&
    (toDate(row.expires_at)!.getTime() <= now.getTime() ||
      row.question_version !== QUESTION_VERSION)
  ) {
    return "expired";
  }
  return row.status;
}

export type CreateResult =
  | { ok: true; surveyId: string; hostKey: string }
  | { ok: false; error: NicknameError | "bad_target" };

export async function createSurvey(
  input: { nickname: unknown; targetCount: unknown },
  now = new Date(),
): Promise<CreateResult> {
  const { value, error } = checkNickname(String(input.nickname ?? ""));
  if (error) return { ok: false, error };
  const n = Number(input.targetCount);
  if (!Number.isInteger(n) || n < MIN_TARGET || n > MAX_TARGET) {
    return { ok: false, error: "bad_target" };
  }
  const surveyId = newId();
  const hostKey = newId();
  const db = await getDb();
  await db.query(
    `insert into surveys (id, host_key_hash, nickname, target_count, expires_at, question_version)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      surveyId,
      hashKey(hostKey),
      value,
      n,
      new Date(now.getTime() + OPEN_DAYS * DAY),
      QUESTION_VERSION,
    ],
  );
  return { ok: true, surveyId, hostKey };
}

export interface PublicView {
  nickname: string;
  status: Status;
  targetCount: number;
  remaining: number;
}

export async function getPublic(
  surveyId: string,
  now = new Date(),
): Promise<PublicView | null> {
  const db = await getDb();
  const { rows } = await db.query<SurveyRow>(
    `select * from surveys where id = $1`,
    [surveyId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    nickname: row.nickname,
    status: effectiveStatus(row, now),
    targetCount: row.target_count,
    remaining: Math.max(0, row.target_count - row.response_count),
  };
}

export async function hasResponded(
  surveyId: string,
  respondentKey: string,
): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(
    `select 1 from responses where survey_id = $1 and respondent_key = $2`,
    [surveyId, respondentKey],
  );
  return rows.length > 0;
}

export type SubmitStatus =
  | "accepted"
  | "completed"
  | "closed"
  | "duplicate"
  | "invalid"
  | "expired"
  | "not_found";

export async function submitResponse(
  surveyId: string,
  input: { answers: unknown; relation?: unknown },
  respondentKey: string,
  now = new Date(),
): Promise<{ status: SubmitStatus; remaining?: number }> {
  if (validateAnswers(input.answers, { allowUnknown: true }) !== null) {
    return { status: "invalid" };
  }
  const answers = input.answers as number[];
  const relation =
    typeof input.relation === "string" &&
    RELATIONS.some((r) => r.id === input.relation)
      ? input.relation
      : null;
  const db = await getDb();
  return db.transaction(async (tx) => {
    // この診断の行を止め、同時に来た回答を 1 件ずつ順に処理する（§11.2）
    const { rows } = await tx.query<SurveyRow>(
      `select * from surveys where id = $1 for update`,
      [surveyId],
    );
    const row = rows[0];
    if (!row) return { status: "not_found" as const };
    const status = effectiveStatus(row, now);
    if (status === "expired") return { status: "expired" as const };
    if (status !== "open" || row.response_count >= row.target_count) {
      return { status: "closed" as const };
    }
    const dup = await tx.query(
      `select 1 from responses where survey_id = $1 and respondent_key = $2`,
      [surveyId, respondentKey],
    );
    if (dup.rows.length > 0) return { status: "duplicate" as const };
    await tx.query(
      `insert into responses (survey_id, respondent_key, answers, relation)
       values ($1, $2, $3, $4)`,
      [surveyId, respondentKey, answers, relation],
    );
    const count = row.response_count + 1;
    if (count < row.target_count) {
      await tx.query(`update surveys set response_count = $2 where id = $1`, [
        surveyId,
        count,
      ]);
      return {
        status: "accepted" as const,
        remaining: row.target_count - count,
      };
    }
    await complete(tx, row, count, now);
    return { status: "completed" as const, remaining: 0 };
  });
}

// N 人目を受け付けたのと同じトランザクションの中で、結果を 1 回だけ計算して確定する
async function complete(
  tx: Queryable,
  row: SurveyRow,
  count: number,
  now: Date,
): Promise<void> {
  const { rows } = await tx.query<{
    answers: number[];
    relation: string | null;
  }>(
    `select answers, relation from responses where survey_id = $1 order by id`,
    [row.id],
  );
  const result = computeResult(
    rows.map((r) => ({ answers: r.answers.map(Number), relation: r.relation })),
    row.self_answers ? row.self_answers.map(Number) : null,
  );
  await tx.query(
    `update surveys
       set response_count = $2, status = 'completed', completed_at = $3,
           delete_at = $4, result = $5
     where id = $1`,
    [
      row.id,
      count,
      now,
      new Date(now.getTime() + KEEP_COMPLETED_DAYS * DAY),
      JSON.stringify(result),
    ],
  );
}

export interface HostView {
  surveyId: string;
  nickname: string;
  status: Status;
  targetCount: number;
  responseCount: number;
  hasSelf: boolean;
  selfAnswers: number[] | null;
  extended: boolean;
  expiresAt: string;
  deleteAt: string | null;
  // 保存期限までの残り日数（切り上げ）
  daysLeft: number | null;
  shareId: string | null;
  result: Result | null;
  // 人数をふやすときの最小の人数。ふやせないなら null（§5.4）
  raiseMin: number | null;
  // 応援（§4.11）：「応援する」を押したか（押すとスペシャルなシェア画像を贈る）・スペシャルな画像を作れるか・
  // 特典つきの応援で、くわしい分析を開いたか・くわしい分析・出せるときの値段
  gifted: boolean;
  special: boolean;
  premium: boolean;
  analysis: DetailedAnalysis | null;
  // タコ占いの合言葉（特典を開いた診断だけ）
  fortuneCode: string | null;
  offer: PremiumOffer | null;
}

// §5.4：ふやせる最小の人数。受付中は 1 人以上、結果が出たあとは 3 人以上ふやす。上限は 30 人
function raiseMinOf(row: SurveyRow, status: Status): number | null {
  if (row.question_version !== QUESTION_VERSION) return null;
  if (status !== "open" && status !== "completed") return null;
  const min =
    row.target_count + (status === "completed" ? MIN_RAISE_AFTER_RESULT : 1);
  return min <= MAX_TARGET ? min : null;
}

async function findByHostKey(q: Queryable, hostKey: string, lock = false) {
  const { rows } = await q.query<SurveyRow>(
    `select * from surveys where host_key_hash = $1${lock ? " for update" : ""}`,
    [hashKey(hostKey)],
  );
  return rows[0] ?? null;
}

export async function getHost(
  hostKey: string,
  now = new Date(),
): Promise<HostView | null> {
  const db = await getDb();
  const row = await findByHostKey(db, hostKey);
  if (!row) return null;
  const status = effectiveStatus(row, now);
  const premium = Boolean(row.premium_at);
  const selfAnswers = row.self_answers ? row.self_answers.map(Number) : null;
  return {
    surveyId: row.id,
    nickname: row.nickname,
    status,
    targetCount: row.target_count,
    responseCount: row.response_count,
    hasSelf: row.self_answers !== null,
    selfAnswers,
    extended: row.extended,
    expiresAt: toDate(row.expires_at)!.toISOString(),
    deleteAt: row.delete_at ? toDate(row.delete_at)!.toISOString() : null,
    daysLeft: row.delete_at
      ? Math.max(
          0,
          Math.ceil((toDate(row.delete_at)!.getTime() - now.getTime()) / DAY),
        )
      : null,
    shareId: row.share_id,
    // 確定した診断だけ結果を返す
    result: status === "completed" ? parseResult(row.result) : null,
    raiseMin: raiseMinOf(row, status),
    gifted: Boolean(row.gift_at),
    special: premium || Boolean(row.gift_at),
    premium,
    analysis:
      premium && status === "completed"
        ? await detailedAnalysis(row.id, selfAnswers)
        : null,
    fortuneCode: premium ? (row.fortune_code ?? null) : null,
    offer: premiumOffer(),
  };
}

export type HostActionStatus =
  | "ok"
  | "not_found"
  | "not_open"
  | "invalid"
  | "already";

export async function saveSelf(
  hostKey: string,
  answers: unknown,
  now = new Date(),
): Promise<HostActionStatus> {
  if (validateAnswers(answers, { allowUnknown: false }) !== null)
    return "invalid";
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await findByHostKey(tx, hostKey, true);
    if (!row) return "not_found";
    if (effectiveStatus(row, now) !== "open") return "not_open";
    await tx.query(`update surveys set self_answers = $2 where id = $1`, [
      row.id,
      answers,
    ]);
    return "ok";
  });
}

export async function extendSurvey(
  hostKey: string,
  now = new Date(),
): Promise<HostActionStatus> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await findByHostKey(tx, hostKey, true);
    if (!row) return "not_found";
    if (effectiveStatus(row, now) !== "open") return "not_open";
    if (row.extended) return "already";
    const next = new Date(
      toDate(row.expires_at)!.getTime() + EXTEND_DAYS * DAY,
    );
    await tx.query(
      `update surveys set expires_at = $2, extended = true where id = $1`,
      [row.id, next],
    );
    return "ok";
  });
}

// §5.4：人数をふやす。同じ招待リンクで受付を続け、前の回答はそのまま使う。
// 結果が出ていた診断は受付中に戻し、新しい人数がそろったら結果を出し直す
// （それまでの結果と公開リンクは消す。受付の期限は今日から 30 日にし、延長をもう一度使えるようにする）
export async function raiseTarget(
  hostKey: string,
  target: unknown,
  now = new Date(),
): Promise<HostActionStatus> {
  const n = Number(target);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await findByHostKey(tx, hostKey, true);
    if (!row) return "not_found";
    const status = effectiveStatus(row, now);
    const min = raiseMinOf(row, status);
    if (min === null) return "not_open";
    if (!Number.isInteger(n) || n < min || n > MAX_TARGET) return "invalid";
    if (status === "open") {
      await tx.query(`update surveys set target_count = $2 where id = $1`, [
        row.id,
        n,
      ]);
    } else {
      await tx.query(
        `update surveys
         set status = 'open', target_count = $2, result = null, completed_at = null,
             delete_at = null, share_id = null, expires_at = $3, extended = false
         where id = $1`,
        [row.id, n, new Date(now.getTime() + OPEN_DAYS * DAY)],
      );
    }
    return "ok";
  });
}

export async function setShare(
  hostKey: string,
  on: boolean,
  now = new Date(),
): Promise<{ status: HostActionStatus; shareId?: string | null }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await findByHostKey(tx, hostKey, true);
    if (!row) return { status: "not_found" as const };
    if (effectiveStatus(row, now) !== "completed")
      return { status: "not_open" as const };
    if (!on) {
      await tx.query(`update surveys set share_id = null where id = $1`, [
        row.id,
      ]);
      return { status: "ok" as const, shareId: null };
    }
    if (row.share_id) return { status: "ok" as const, shareId: row.share_id };
    const shareId = newId();
    await tx.query(`update surveys set share_id = $2 where id = $1`, [
      row.id,
      shareId,
    ]);
    return { status: "ok" as const, shareId };
  });
}

// 応援のお願いで「応援する」を押した：先にスペシャルなシェア画像を贈る（§4.11）。結果が出た診断だけ
export async function giveGift(
  hostKey: string,
  now = new Date(),
): Promise<HostActionStatus> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await findByHostKey(tx, hostKey, true);
    if (!row) return "not_found";
    if (effectiveStatus(row, now) !== "completed") return "not_open";
    await tx.query(
      `update surveys set gift_at = coalesce(gift_at, $2) where id = $1`,
      [row.id, now],
    );
    return "ok";
  });
}

// 運営者が、報告された診断を消す（利用規約 第4条）
export async function deleteSurveyById(surveyId: string): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from surveys where id = $1 returning id`,
    [surveyId],
  );
  return rows.length > 0;
}

export async function deleteSurvey(hostKey: string): Promise<HostActionStatus> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from surveys where host_key_hash = $1 returning id`,
    [hashKey(hostKey)],
  );
  return rows.length > 0 ? "ok" : "not_found";
}

// 公開リンク用。シェア画像と同じ内容だけを返す（§4.12）
export interface SharedView {
  nickname: string;
  n: number;
  type: Result["type"];
  axes: Pick<Result["axes"][number], "axis" | "pole" | "percent" | "tie">[];
}

export function toShared(nickname: string, result: Result): SharedView {
  return {
    nickname,
    n: result.n,
    type: result.type,
    axes: result.axes.map(({ axis, pole, percent, tie }) => ({
      axis,
      pole,
      percent,
      tie,
    })),
  };
}

export async function getShared(shareId: string): Promise<SharedView | null> {
  const db = await getDb();
  const { rows } = await db.query<SurveyRow>(
    `select * from surveys where share_id = $1 and status = 'completed'`,
    [shareId],
  );
  const row = rows[0];
  const result = row ? parseResult(row.result) : null;
  if (!row || !result) return null;
  return toShared(row.nickname, result);
}

// 1 日 1 回の定時処理（§5.2・§11.2）
export async function cleanup(
  now = new Date(),
): Promise<{ expired: number; deleted: number }> {
  const db = await getDb();
  const expired = await db.query(
    `update surveys set status = 'expired', delete_at = $2
      where status = 'open' and expires_at <= $1 returning id`,
    [now, new Date(now.getTime() + KEEP_EXPIRED_DAYS * DAY)],
  );
  const deleted = await db.query(
    `delete from surveys where delete_at is not null and delete_at <= $1 returning id`,
    [now],
  );
  return { expired: expired.rows.length, deleted: deleted.rows.length };
}
