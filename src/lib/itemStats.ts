// 問ごとの質（仕様書 §11.12）。回答データがたまったら、測る道具として問がうまく働いているかを確かめる。
// テストを除いた最近の回答をまとめて数えるだけで、だれの・どの診断の答えかは出さない。
// - 軸ごとのまとまり（クロンバックの α）：基本の 4 問（だれにも出る問）が同じ向きのことを測れているか。0.7 前後あれば目安を満たす
// - 問ごとの「ほかの問との相関」：基本の問は、同じ軸のほかの基本の 3 問の合計点との相関。
//   深掘りの問は、同じ軸の基本の 4 問の合計点との相関（深掘りを出した人だけで数える）。低い・マイナスの問は見直す
// - 問ごとの「わからない」の割合：友達から見えにくい問ほど高い
// - 問ごとの、向きをそろえた点の平均。深掘りの問は基本の答えが半々に近い人にだけ出るので、平均はふつう 4 に近い。
//   4 から大きく離れた深掘りの問は、言い方が一方の極に寄っている（だれでも「そう思う」と答えやすいなど）おそれがある

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
  // 基本の問か、深掘りの問か（深掘りの問は出した人だけで数える）
  stage?: "core" | "follow";
  // 1〜7 で答えた回答の数（平均に使った数）
  answered?: number;
  // その軸の左の極の向きにそろえた点の平均（1〜7。4 がどちらとも）
  mean: number | null;
  itemRest: number | null;
  unknownRate: number | null;
}

export interface AxisItems {
  axis: Axis;
  name: string;
  n: number; // 基本の 4 問とも 1〜7 で答えた回答の数（α に使った数）
  alpha: number | null;
  items: ItemRow[]; // 基本の 4 問のあとに、深掘りの 4 問
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
    const unknownRate = (no: number) => {
      const asked = answers.filter((r) => r[no - 1] >= 0);
      const unknown = asked.filter((r) => r[no - 1] === 0).length;
      return asked.length >= MIN_ITEM_RESPONSES
        ? round2(unknown / asked.length)
        : null;
    };
    const items: ItemRow[] = core.map((q, j) => {
      const item = full.map((r) => r[j]);
      const rest = full.map((r) => r.reduce((a, b) => a + b, 0) - r[j]);
      return {
        no: q.no,
        summary: q.summary,
        pole: q.pole,
        stage: "core",
        answered: full.length,
        mean: enough
          ? round2(item.reduce((a, b) => a + b, 0) / item.length)
          : null,
        itemRest: enough ? round2(corr(item, rest)) : null,
        unknownRate: unknownRate(q.no),
      };
    });
    const isAnswer = (v: number) => v >= 1 && v <= 7;
    for (const q of QUESTIONS.filter(
      (x) => x.axis === axis && x.stage === "follow",
    )) {
      // その深掘りの問に 1〜7 で答えた回答（相関は、基本の 4 問にも答えた回答だけ）
      const rows = answers.filter((r) => isAnswer(r[q.no - 1]));
      const item = rows.map((r) => keyed(q, r[q.no - 1]));
      const withCore = rows.filter((r) =>
        core.every((c) => isAnswer(r[c.no - 1])),
      );
      const ok = rows.length >= MIN_ITEM_RESPONSES;
      const okCore = withCore.length >= MIN_ITEM_RESPONSES;
      items.push({
        no: q.no,
        summary: q.summary,
        pole: q.pole,
        stage: "follow",
        answered: rows.length,
        mean: ok ? round2(item.reduce((a, b) => a + b, 0) / item.length) : null,
        itemRest: okCore
          ? round2(
              corr(
                withCore.map((r) => keyed(q, r[q.no - 1])),
                withCore.map((r) =>
                  core.reduce((a, c) => a + keyed(c, r[c.no - 1]), 0),
                ),
              ),
            )
          : null,
        unknownRate: unknownRate(q.no),
      });
    }
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
