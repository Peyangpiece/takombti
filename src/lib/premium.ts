// 特典つきの応援で開く「くわしい分析」（仕様書 §4.11）。
// 匿名性の決まり（§8.5）は特典でも同じ：だれが何と答えたかは出さない。問いごとの集計は、
// その問いに 1〜7 で答えた人が 3 人以上いるときだけ出し、関係ごとの内訳とは掛け合わせない。
// 人数をふやして出し直したときは、前の結果との差が 0 か 3 人以上の問だけを出す（§5.4）。
// 平均とばらつきは、組み合わせると 1 人ずつの答えまで割り出せるので、サーバーの中だけで使い、送らない

import {
  QUESTIONS,
  QUESTION_VERSION,
  SUMMARIES_V1,
  type Axis,
} from "../data/questions";
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
  // みんなの答えの向き（平均 5 以上：agree・3 以下：disagree・そのあいだ：middle）
  lean: "agree" | "disagree" | "middle";
  // ホストの自己回答（あれば）
  self: number | null;
}

// ジョハリの窓（自己回答があるときだけ）。問いの要約を 2 つまで
export interface Johari {
  open: string[];
  blind: string[];
  hidden: string[];
}

export interface DetailedAnalysis {
  questions: QuestionStat[];
  // 意見がいちばんそろった問い（3 つ）・はっきり分かれた問い（そろった問いよりばらつきが SPLIT_MARGIN 以上大きいものを 3 つまで）
  agreed: number[];
  split: number[];
  johari: Johari | null;
  // 自己回答と周りの平均の差が大きい問い（3 つまで。自己回答があるときだけ）
  gaps: number[];
  // 友達 1 人ずつの見え方の図（MIN_DOTPLOT 人以上のときだけ）。軸ごとに、左の極にはっきり寄った段階から順に人数を並べる
  // mid：真ん中の段階の人のうち、左の極・右の極に少しでも寄っていた人数（残りはちょうど 0 点）。
  // median：中央値の段階（匿名性のため、点と同じ段階に丸める）
  dots:
    | {
        axis: Axis;
        bins: number[];
        mid: { left: number; right: number };
        median: number;
      }[]
    | null;
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
  const half = (DOT_BINS - 1) / 2;
  return AXES.map(({ axis }) => {
    const bins = Array<number>(DOT_BINS).fill(0);
    const mid = { left: 0, right: 0 };
    const scores: number[] = [];
    for (const r of responses) {
      const x = raterAxisScore(r, axis);
      if (x === null) continue;
      scores.push(x);
      const b = dotBin(x);
      bins[b] += 1;
      if (b === half && x > 0) mid.left += 1;
      if (b === half && x < 0) mid.right += 1;
    }
    scores.sort((a, b) => a - b);
    const m = scores.length >> 1;
    const median =
      scores.length % 2 === 1 ? scores[m] : (scores[m - 1] + scores[m]) / 2;
    return { axis, bins, mid, median: dotBin(median) };
  });
}

// 版 1（24 問）の問。軸は 1 問ずつ A1→A4 の順にくり返す。極は持っていないので、図（dots）は作らない
const ITEMS_V1 = SUMMARIES_V1.map((summary, i) => ({
  no: i + 1,
  axis: `A${(i % 4) + 1}` as Axis,
  summary,
}));

// 「分かれた」と言えるだけの差。そろった問いとのばらつきの差がこれより小さければ、分かれたとは言わない
export const SPLIT_MARGIN = 0.5;

const isAnswer = (v: number | undefined): v is number =>
  v !== undefined && v >= 1 && v <= 7;

// version：その診断の問の版。保存した回答は、その版の問の番号で、届いた順に並んでいる。
// boundaries：人数をふやす前に結果を出したときの回答の数
export function analyze(
  responses: number[][],
  self: number[] | null,
  version = QUESTION_VERSION,
  boundaries: number[] = [],
): DetailedAnalysis {
  const current = version === QUESTION_VERSION;
  const prior = boundaries.filter((b) => b < responses.length);
  const stats: (QuestionStat & { mean: number; sd: number })[] = [];
  for (const q of current ? QUESTIONS : ITEMS_V1) {
    const values = responses.map((a) => a[q.no - 1]).filter(isAnswer);
    if (values.length < MIN_PER_QUESTION) continue;
    // 前の結果から 1〜2 人だけ増えた問は出さない（差から、その人の答えが分かるため）
    const before = prior.map(
      (b) => responses.slice(0, b).filter((a) => isAnswer(a[q.no - 1])).length,
    );
    if (
      !before.every(
        (c) => c === values.length || values.length - c >= MIN_PER_QUESTION,
      )
    )
      continue;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const sv = self?.[q.no - 1];
    stats.push({
      no: q.no,
      axis: q.axis,
      summary: q.summary,
      answered: values.length,
      agree: values.filter((v) => v >= 5).length,
      neutral: values.filter((v) => v === 4).length,
      disagree: values.filter((v) => v <= 3).length,
      lean: mean >= 5 ? "agree" : mean <= 3 ? "disagree" : "middle",
      self: isAnswer(sv) ? sv : null,
      mean,
      sd: Math.sqrt(variance),
    });
  }
  const bySpread = [...stats].sort((a, b) => a.sd - b.sd || a.no - b.no);
  const base = bySpread[0]?.sd ?? 0;
  const gapOf = (s: (typeof stats)[number]) =>
    s.self === null ? 0 : Math.abs(s.self - s.mean);
  const withSelf = stats.filter((q) => q.self !== null);
  const pick = (list: typeof stats) => list.slice(0, 2).map((q) => q.summary);
  return {
    questions: stats.map(
      ({
        no,
        axis,
        summary,
        answered,
        agree,
        neutral,
        disagree,
        lean,
        self,
      }) => ({
        no,
        axis,
        summary,
        answered,
        agree,
        neutral,
        disagree,
        lean,
        self,
      }),
    ),
    agreed: bySpread.slice(0, 3).map((s) => s.no),
    split: bySpread
      .slice(-3)
      .reverse()
      .filter((s) => s.sd > 0 && s.sd - base >= SPLIT_MARGIN)
      .map((s) => s.no),
    gaps: [...stats]
      .filter((s) => s.self !== null && gapOf(s) >= 1.5)
      .sort((a, b) => gapOf(b) - gapOf(a) || a.no - b.no)
      .slice(0, 3)
      .map((s) => s.no),
    johari:
      withSelf.length === 0
        ? null
        : {
            // 自分も周りも「そう思う」：開放の窓
            open: pick(
              withSelf
                .filter((q) => q.self! >= 5 && q.mean >= 5)
                .sort((a, b) => b.mean - a.mean),
            ),
            // 周りは「そう思う」のに、自分ではそう思っていない：盲点の窓
            blind: pick(
              withSelf
                .filter(
                  (q) => q.mean >= 5 && q.self! <= 4 && q.mean - q.self! >= 1.5,
                )
                .sort((a, b) => b.mean - b.self! - (a.mean - a.self!)),
            ),
            // 自分では「そう思う」のに、周りにはまだ伝わっていない：秘密の窓
            hidden: pick(
              withSelf
                .filter(
                  (q) =>
                    q.self! >= 5 && q.mean <= 3.5 && q.self! - q.mean >= 1.5,
                )
                .sort((a, b) => b.self! - b.mean - (a.self! - a.mean)),
            ),
          },
    dots: current ? dotsOf(responses) : null,
  };
}
