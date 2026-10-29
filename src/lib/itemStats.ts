// 問ごとの質（仕様書 §11.12）。回答データがたまったら、測る道具として問がうまく働いているかを確かめる。
// 基本の 16 問（だれにも出る問）について、テストを除いた最近の回答をまとめて数えるだけで、だれの・どの診断の答えかは出さない。
// - 軸ごとのまとまり（クロンバックの α）：同じ軸の 4 問が同じ向きのことを測れているか。0.7 前後あれば目安を満たす
// - 問ごとの「ほかの問との相関」：その問の点と、同じ軸のほかの 3 問の合計点の相関。低い・マイナスの問は見直す
// - 問ごとの「わからない」の割合：友達から見えにくい問ほど高い

import { getDb } from "./db";
import { AXES } from "../data/framework";
import { QUESTIONS, QUESTION_VERSION, type Axis } from "../data/questions";

const DAY = 24 * 60 * 60 * 1000;
// これより少ないと数字がぶれるので、値を出さない
export const MIN_ITEM_RESPONSES = 30;

export interface ItemRow {
  no: number;
  summary: string;
  pole: string;
  // その軸の左の極の向きにそろえた点の平均（1〜7。4 がどちらとも）
  mean: number | null;
  itemRest: number | null;
  unknownRate: number | null;
}

export interface AxisItems {
  axis: Axis;
  name: string;
  n: number; // 4 問とも 1〜7 で答えた回答の数（α に使った数）
  alpha: number | null;
  items: ItemRow[];
}

export interface ItemSummary {
  days: number;
  responses: number;
  axes: AxisItems[];
}

function variance(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}

function corr(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

// クロンバックの α（k 問の点の行列。行が回答）
export function cronbachAlpha(rows: number[][]): number | null {
  if (rows.length < 2) return null;
  const k = rows[0].length;
  const itemVar = Array.from({ length: k }, (_, j) =>
    variance(rows.map((r) => r[j])),
  ).reduce((a, b) => a + b, 0);
  const totalVar = variance(rows.map((r) => r.reduce((a, b) => a + b, 0)));
  return totalVar > 0 ? (k / (k - 1)) * (1 - itemVar / totalVar) : null;
}

const round2 = (x: number | null) =>
  x === null ? null : Math.round(x * 100) / 100;

export function summarizeAnswers(answers: number[][]): AxisItems[] {
  return AXES.map(({ axis, name, left }) => {
    const core = QUESTIONS.filter((q) => q.axis === axis && q.stage === "core");
    // 左の極の向きにそろえる（右の極の問は 8 − 答え）
    const keyed = (q: (typeof core)[number], a: number) =>
      q.pole === left ? a : 8 - a;
    const full = answers
      .filter((r) => core.every((q) => r[q.no - 1] >= 1 && r[q.no - 1] <= 7))
      .map((r) => core.map((q) => keyed(q, r[q.no - 1])));
    const enough = full.length >= MIN_ITEM_RESPONSES;
    const items = core.map((q, j) => {
      const asked = answers.filter((r) => r[q.no - 1] >= 0);
      const unknown = asked.filter((r) => r[q.no - 1] === 0).length;
      const item = full.map((r) => r[j]);
      const rest = full.map((r) => r.reduce((a, b) => a + b, 0) - r[j]);
      return {
        no: q.no,
        summary: q.summary,
        pole: q.pole,
        mean: enough
          ? round2(item.reduce((a, b) => a + b, 0) / item.length)
          : null,
        itemRest: enough ? round2(corr(item, rest)) : null,
        unknownRate:
          asked.length >= MIN_ITEM_RESPONSES
            ? round2(unknown / asked.length)
            : null,
      };
    });
    return {
      axis,
      name,
      n: full.length,
      alpha: enough ? round2(cronbachAlpha(full)) : null,
      items,
    };
  });
}

// 最近 days 日の、テストを除いた回答（今の版の問で答えたものだけ）。
// 結果が出た診断の回答だけを使う（受付中の診断を入れると、テストの印を付け外しした前後の差から、1 件だけの回答が読めるため）
export async function summarizeItems(
  days = 90,
  now = new Date(),
): Promise<ItemSummary> {
  const db = await getDb();
  const { rows } = await db.query<{ answers: number[] }>(
    `select r.answers from responses r
       join surveys s on s.id = r.survey_id
       left join survey_stats st on st.id = s.stats_id
      where r.created_at >= $1 and s.question_version = $2
        and s.status = 'completed'
        and coalesce(st.test, false) = false`,
    [new Date(now.getTime() - days * DAY), QUESTION_VERSION],
  );
  const answers = rows.map((r) => r.answers.map(Number));
  return { days, responses: answers.length, axes: summarizeAnswers(answers) };
}
