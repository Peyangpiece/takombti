// 特典つきの応援で開く「くわしい分析」（仕様書 §4.11）。
// 匿名性の決まり（§8.5）は特典でも同じ：だれが何と答えたかは出さない。問いごとの集計は、
// その問いに 1〜7 で答えた人が 3 人以上いるときだけ出し、関係ごとの内訳とは掛け合わせない。

import { QUESTIONS, type Axis } from "../data/questions";
import { AXES } from "../data/framework";
import { MAX_RATER_SCORE, raterAxisScore } from "./scoring";

export const MIN_PER_QUESTION = 3;
// 友達 1 人ずつの見え方の図（§4.11）を出す人数。点 1 つが 1 人なので、少ないとだれの点か見当がつきやすい
export const MIN_DOTPLOT = 10;
// 図の段階の数。真ん中の段階をはさんで、左右に 4 段階ずつ
export const DOT_BINS = 9;

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
  // 友達 1 人ずつの見え方の図（MIN_DOTPLOT 人以上のときだけ）。軸ごとに、左の極にはっきり寄った段階から順に人数を並べる
  dots: { axis: Axis; bins: number[] }[] | null;
}

// 1 人の軸の点（左の極が正）を、図の段階（0 が左端・DOT_BINS - 1 が右端）にする。
// 左右で同じ幅になるよう、0 から遠いほうへ四捨五入する
export function dotBin(score: number): number {
  const half = (DOT_BINS - 1) / 2;
  const v = (score * half) / MAX_RATER_SCORE;
  return half - Math.sign(v) * Math.round(Math.abs(v));
}

function dotsOf(responses: number[][]): DetailedAnalysis["dots"] {
  if (responses.length < MIN_DOTPLOT) return null;
  return AXES.map(({ axis }) => {
    const bins = Array<number>(DOT_BINS).fill(0);
    for (const r of responses) {
      const x = raterAxisScore(r, axis);
      if (x !== null) bins[dotBin(x)] += 1;
    }
    return { axis, bins };
  });
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
    dots: dotsOf(responses),
  };
}
