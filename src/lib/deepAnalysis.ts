// くわしい分析の読み物（特典つきの応援。仕様書 §4.11）。
// タイプごとの文（src/data/deepTypes.ts）に、その人の結果（4 つの軸の割合・問いごとの答え・自己回答）から
// 組み立てた文を足す。だれが何と答えたかは出さない（問いごとの集計は 3 人以上が答えた問いだけ）
import { DEEP_TYPES, type DeepItem } from "../data/deepTypes";
import { AXIS_CLEAR, AXIS_LEAN, AXIS_MIXED } from "../data/deepAxes";
import { AXES, POLE_LABEL, type TypeCode } from "../data/framework";
import type { AxisResult } from "./scoring";
import type { DetailedAnalysis, QuestionStat } from "./premium";

// 章（目次にも使う）。text か items のどちらか
export interface DeepChapter {
  id: string;
  title: string;
  text?: string;
  items?: DeepItem[];
}

export interface DeepReading {
  chapters: DeepChapter[];
  axes: { label: string; text: string }[];
  // 友達の答えから読めること（そろった問い・分かれた問い）
  view: string[];
  // ジョハリの窓（自己回答があるときだけ）。問いの要約を 2 つまで
  johari: { open: string[]; blind: string[]; hidden: string[] } | null;
}

// 「分かれた」と言えるだけの差。そろった問いとのばらつきの差がこれより小さければ、分かれたとは言わない
export const SPLIT_MARGIN = 0.5;

export function meaningfulSplit(analysis: DetailedAnalysis): number[] {
  const byNo = new Map(analysis.questions.map((q) => [q.no, q]));
  const base = byNo.get(analysis.agreed[0])?.spread ?? 0;
  return analysis.split.filter(
    (no) => (byNo.get(no)?.spread ?? 0) - base >= SPLIT_MARGIN,
  );
}

function axisText(a: AxisResult): string {
  if (a.tie || a.strength === "ほぼ半々") return AXIS_MIXED[a.axis];
  return a.strength === "やや" ? AXIS_LEAN[a.pole] : AXIS_CLEAR[a.pole];
}

function agreedText(q: QuestionStat): string {
  const head = `友達の答えがいちばんそろっていたのは『${q.summary}』でした。`;
  if (q.average >= 5)
    return `${head}${q.answered} 人のうち ${q.agree} 人が「そう思う」と答えていて、あなたらしさとして、はっきり伝わっている部分です。`;
  if (q.average <= 3)
    return `${head}${q.answered} 人のうち ${q.disagree} 人が「ちがう」と答えていて、あなたにはあまり当てはまらない、と周りがそろって感じている部分です。`;
  return `${head}みんなの答えが「どちらとも」のあたりに集まっていて、場面によって見え方が変わる部分のようです。`;
}

const SPLIT_TEXT = (q: QuestionStat) =>
  `反対に、答えがいちばん分かれたのは『${q.summary}』でした。心理学では、相手や場面に合わせてふるまいを調整することを「セルフ・モニタリング」と呼びます。友達によって見せている顔が少しずつちがうのかもしれません。`;

export function deepReading(
  code: TypeCode,
  axes: AxisResult[],
  analysis: DetailedAnalysis,
): DeepReading {
  const t = DEEP_TYPES[code];
  const byNo = new Map(analysis.questions.map((q) => [q.no, q]));
  const view: string[] = [];
  const agreed = byNo.get(analysis.agreed[0]);
  if (agreed) view.push(agreedText(agreed));
  const split = byNo.get(meaningfulSplit(analysis)[0] ?? -1);
  if (split) view.push(SPLIT_TEXT(split));

  const withSelf = analysis.questions.filter((q) => q.self !== null);
  const johari =
    withSelf.length === 0
      ? null
      : {
          // 自分も周りも「そう思う」：開放の窓
          open: withSelf
            .filter((q) => q.self! >= 5 && q.average >= 5)
            .sort((a, b) => b.average - a.average)
            .slice(0, 2)
            .map((q) => q.summary),
          // 周りは「そう思う」のに、自分ではそう思っていない：盲点の窓
          blind: withSelf
            .filter(
              (q) =>
                q.average >= 5 && q.self! <= 4 && q.average - q.self! >= 1.5,
            )
            .sort((a, b) => b.average - b.self! - (a.average - a.self!))
            .slice(0, 2)
            .map((q) => q.summary),
          // 自分では「そう思う」のに、周りにはまだ伝わっていない：秘密の窓
          hidden: withSelf
            .filter(
              (q) =>
                q.self! >= 5 && q.average <= 3.5 && q.self! - q.average >= 1.5,
            )
            .sort((a, b) => b.self! - b.average - (a.self! - a.average))
            .slice(0, 2)
            .map((q) => q.summary),
        };

  return {
    chapters: [
      { id: "intro", title: "概要", text: t.intro },
      { id: "strengths", title: "強み", items: t.strengths },
      { id: "weaknesses", title: "気をつけたいところ", items: t.weaknesses },
      { id: "love", title: "恋愛・パートナーとの関係", text: t.love },
      { id: "friendship", title: "友人関係", text: t.friendship },
      { id: "career", title: "学び方・仕事の進め方", text: t.career },
      { id: "workplace", title: "学校・バイト・職場での姿", text: t.workplace },
      { id: "stress", title: "疲れやすいところと、立て直し方", text: t.stress },
      { id: "growth", title: "これからの伸びしろ", text: t.growth },
      { id: "conclusion", title: "まとめ", text: t.conclusion },
    ],
    axes: axes.map((a) => {
      const def = AXES.find((d) => d.axis === a.axis)!;
      return {
        label: `${POLE_LABEL[def.left].name} / ${POLE_LABEL[def.right].name}`,
        text: axisText(a),
      };
    }),
    view,
    johari,
  };
}
