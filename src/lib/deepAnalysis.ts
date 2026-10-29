// くわしい分析の読み物（特典つきの応援。仕様書 §4.11）。
// タイプごとの文（src/data/deepTypes.ts）に、その人の結果（4 つの軸の割合・問いごとの答え・自己回答）から
// 組み立てた文を足す。だれが何と答えたかは出さない（問いごとの集計は 3 人以上が答えた問いだけ）
import { DEEP_TYPES, type DeepItem } from "../data/deepTypes";
import {
  AXIS_ALIGNED,
  AXIS_CLEAR,
  AXIS_DIVIDED_EVEN,
  AXIS_DIVIDED_LEAN,
  AXIS_LEAN,
  AXIS_MIDDLE,
  AXIS_MIDDLE_LEAN,
  AXIS_MIXED,
} from "../data/deepAxes";
import { AXES, POLE_LABEL, type TypeCode } from "../data/framework";
import type { AxisResult, SelfAxis, Spread } from "./scoring";
import type { DetailedAnalysis, Johari, QuestionStat } from "./premium";

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
  // ジョハリの窓（自己回答があるときだけ。サーバーで選ぶ）
  johari: Johari | null;
}

// 軸の文。割合（しっかり・やや・ほぼ半々）で選んだ文に、友達の見え方の散らばりを重ねる（§4.11）
function axisText(
  a: AxisResult,
  spread: Spread | null,
  self: SelfAxis | undefined,
): string {
  const even = a.tie || a.strength === "ほぼ半々";
  let text: string;
  if (even) {
    text =
      spread === "divided"
        ? AXIS_DIVIDED_EVEN[a.axis]
        : spread === "middle"
          ? AXIS_MIDDLE[a.axis]
          : AXIS_MIXED[a.axis];
  } else {
    const base = a.strength === "やや" ? AXIS_LEAN[a.pole] : AXIS_CLEAR[a.pole];
    const note =
      spread === "aligned"
        ? AXIS_ALIGNED[a.pole]
        : spread === "divided"
          ? AXIS_DIVIDED_LEAN[a.pole]
          : spread === "middle"
            ? AXIS_MIDDLE_LEAN
            : "";
    text = base + note;
  }
  // 見え方が分かれた軸は、自分ではどちらだと思っているかを添える（ど真ん中と答えたときは添えない）
  if (spread === "divided" && self && !self.tie) {
    text += `あなた自身は、${POLE_LABEL[self.pole].name}のほうを自分らしいと感じているようです。`;
  }
  return text;
}

// 4 つの軸をまとめて見たときの一文。そろった軸・分かれた軸が多いときだけ
function spreadSummary(spreads: (Spread | null)[]): string | null {
  const count = (s: Spread) => spreads.filter((x) => x === s).length;
  if (count("divided") >= 2)
    return `4 つの軸のうち ${count("divided")} つで、友達によって見え方が分かれました。心理学では、人は付き合う相手ごとに少しずつちがう「社会的な自己」をもつと考えます。あなたは、相手ごとにちがう面を自然に見せられる、幅の広い人なのかもしれません。`;
  if (count("aligned") >= 3)
    return `4 つの軸のうち ${count("aligned")} つで、友達の見え方がそろっていました。だれと一緒にいても、同じあなたが伝わっているようです。`;
  return null;
}

function agreedText(q: QuestionStat): string {
  const head = `友達の答えがいちばんそろっていたのは『${q.summary}』でした。`;
  if (q.lean === "agree")
    return `${head}${q.answered} 人のうち ${q.agree} 人が「そう思う」と答えていて、あなたらしさとして、はっきり伝わっている部分です。`;
  if (q.lean === "disagree")
    return `${head}${q.answered} 人のうち ${q.disagree} 人が「ちがう」と答えていて、あなたにはあまり当てはまらない、と周りがそろって感じている部分です。`;
  return `${head}みんなの答えが「どちらとも」のあたりに集まっていて、場面によって見え方が変わる部分のようです。`;
}

const SPLIT_TEXT = (q: QuestionStat) =>
  `反対に、答えがいちばん分かれたのは『${q.summary}』でした。心理学では、相手や場面に合わせてふるまいを調整することを「セルフ・モニタリング」と呼びます。友達によって見せている顔が少しずつちがうのかもしれません。`;

export function deepReading(
  code: TypeCode,
  axes: AxisResult[],
  analysis: DetailedAnalysis,
  spreads: (Spread | null)[] | null = null,
  self: SelfAxis[] | null = null,
): DeepReading {
  const t = DEEP_TYPES[code];
  const byNo = new Map(analysis.questions.map((q) => [q.no, q]));
  const view: string[] = [];
  const agreed = byNo.get(analysis.agreed[0]);
  if (agreed) view.push(agreedText(agreed));
  const split = byNo.get(analysis.split[0] ?? -1);
  if (split) view.push(SPLIT_TEXT(split));
  const summary = spreads ? spreadSummary(spreads) : null;
  if (summary) view.push(summary);

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
    axes: axes.map((a, i) => {
      const def = AXES.find((d) => d.axis === a.axis)!;
      return {
        label: `${POLE_LABEL[def.left].name} / ${POLE_LABEL[def.right].name}`,
        text: axisText(
          a,
          spreads?.[i] ?? null,
          self?.find((x) => x.axis === a.axis),
        ),
      };
    }),
    view,
    johari: analysis.johari,
  };
}
