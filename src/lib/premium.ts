// 特典つきの応援で開く「くわしい分析」（仕様書 §4.11）。
// 匿名性の決まり（§8.5）は特典でも同じ：だれが何と答えたかは出さない。問いごとの集計は、
// その問いに 1〜7 で答えた人が 3 人以上いるときだけ出し、関係ごとの内訳とは掛け合わせない。

import { getDb } from "./db";
import { QUESTIONS, type Axis } from "../data/questions";

export const MIN_PER_QUESTION = 3;

export interface QuestionStat {
  no: number;
  axis: Axis;
  summary: string;
  // 1〜7 で答えた人の数と、そう思う（5〜7）・どちらとも（4）・ちがう（1〜3）の人数
  answered: number;
  agree: number;
  neutral: number;
  disagree: number;
  // 平均（1〜7）。小数 1 けた
  average: number;
  // ばらつき（標準偏差）。小数 2 けた
  spread: number;
  // ホストの自己回答（あれば）
  self: number | null;
}

export interface DetailedAnalysis {
  questions: QuestionStat[];
  // 意見がいちばんそろった問い・いちばん分かれた問い（3 つずつ）
  agreed: number[];
  split: number[];
  // 自己回答と周りの平均の差が大きい問い（3 つまで。自己回答があるときだけ）
  gaps: number[];
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

export function analyze(
  responses: number[][],
  self: number[] | null,
): DetailedAnalysis {
  const questions: QuestionStat[] = [];
  for (const q of QUESTIONS) {
    const values = responses
      .map((a) => a[q.no - 1])
      .filter((v): v is number => v >= 1 && v <= 7);
    if (values.length < MIN_PER_QUESTION) continue;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const sv = self?.[q.no - 1];
    questions.push({
      no: q.no,
      axis: q.axis,
      summary: q.summary,
      answered: values.length,
      agree: values.filter((v) => v >= 5).length,
      neutral: values.filter((v) => v === 4).length,
      disagree: values.filter((v) => v <= 3).length,
      average: round(mean, 1),
      spread: round(Math.sqrt(variance), 2),
      self: sv !== undefined && sv >= 1 && sv <= 7 ? sv : null,
    });
  }
  const bySpread = [...questions].sort(
    (a, b) => a.spread - b.spread || a.no - b.no,
  );
  const gapOf = (s: QuestionStat) =>
    s.self === null ? 0 : Math.abs(s.self - s.average);
  return {
    questions,
    agreed: bySpread.slice(0, 3).map((s) => s.no),
    split: bySpread
      .slice(-3)
      .reverse()
      .filter((s) => s.spread > 0)
      .map((s) => s.no),
    gaps: [...questions]
      .filter((s) => s.self !== null && gapOf(s) >= 1.5)
      .sort((a, b) => gapOf(b) - gapOf(a) || a.no - b.no)
      .slice(0, 3)
      .map((s) => s.no),
  };
}

export async function detailedAnalysis(
  surveyId: string,
  self: number[] | null,
): Promise<DetailedAnalysis> {
  const db = await getDb();
  const { rows } = await db.query<{ answers: number[] }>(
    `select answers from responses where survey_id = $1`,
    [surveyId],
  );
  return analyze(
    rows.map((r) => r.answers.map(Number)),
    self,
  );
}
