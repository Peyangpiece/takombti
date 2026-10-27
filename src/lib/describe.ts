// 保存した結果の数字を、表示する文に組み立てる（仕様書 §7.5・§7.6・§7.7）。
// 文の型はここにまとめ、数字はすべて結果から差し込む。

import {
  QUESTIONS,
  SUMMARIES_V1,
  type Axis,
  type Pole,
} from "../data/questions";
import {
  AXES,
  POLE_LABEL,
  getType,
  relationLabel,
  type TypeCode,
} from "../data/framework";
import {
  ALGORITHM_VERSION,
  CLEAR_PERCENT,
  type AxisResult,
  type Insight,
  type Result,
  type SelfAxis,
} from "./scoring";

function poleName(p: Pole): string {
  return POLE_LABEL[p].name;
}

function axisName(a: Axis): string {
  return AXES.find((x) => x.axis === a)!.name;
}

// 問の要約。1 版（24 問）で出した結果は、そのときの問の番号で書かれている
function summaryOf(no: number, version: number): string {
  return version === 1 ? SUMMARIES_V1[no - 1] : QUESTIONS[no - 1].summary;
}

// 人数の言い方（§7.5）：全員なら「全員」と添える。それ以外は人数だけ
function countPhrase(count: number, total: number): string {
  if (count === total) return `${total} 人中 ${count} 人（全員）`;
  return `${total} 人中 ${count} 人`;
}

function joinBold(words: string[]): string {
  return words.map((w) => `**${w}**`).join("・");
}

export interface Line {
  rule: string;
  // **で囲んだ部分は太字で表示する
  text: string;
}

// D5・D6 の行動が、その軸の判定と逆向きに見えるとき、その軸の判定（§7.5）。
// 例：判定は内向なのに、外向の行動に全員が「そう思う」。ずれをはっきり書かないと、矛盾して見える。
// 1 版の結果は問の番号がちがうので見ない。ど真ん中の軸は両方の顔があるので、ずれとは言わない
function opposingAxis(
  no: number,
  agree: boolean,
  version: number,
  axes: AxisResult[] | undefined,
): AxisResult | null {
  if (version === 1 || !axes) return null;
  const q = QUESTIONS[no - 1];
  const a = axes.find((x) => x.axis === q.axis);
  if (!a || a.tie) return null;
  // 「そう思う」はその問の極の行動、「ちがう」は反対の極の行動として見る
  return (q.pole === a.pole) !== agree ? a : null;
}

// 判定の言い方。55% 未満（ほぼ半々）なら「わずかに」と添える
function judged(a: AxisResult): string {
  return `判定は${a.percent < 55 ? "わずかに" : ""} **${poleName(a.pole)}**（${a.percent}%）`;
}

export function describeInsight(
  insight: Insight,
  version = ALGORITHM_VERSION,
  axes?: AxisResult[],
): Line {
  switch (insight.rule) {
    case "D1": {
      const { pole, p, N } = insight.params;
      // 「看板」と言い切るのは、しっかり（65%）以上のときだけ
      if (p < CLEAR_PERCENT) {
        return {
          rule: "D1",
          text: `いちばん出たのは **${poleName(pole)}**（${p}%）。ただ、どの軸も強くは出ておらず、ほかのタイプの顔も少しずつ持っています`,
        };
      }
      return {
        rule: "D1",
        text: `いちばんハッキリ出たのは **${poleName(pole)}**（${p}%）。${N} 人から見て、ここはあなたの「看板」です`,
      };
    }
    case "D2": {
      const { poles, N } = insight.params;
      return {
        rule: "D2",
        text: `${joinBold(poles.map(poleName))} は ${N} 人全員の意見が一致。だれの目にもそう映っています`,
      };
    }
    case "D3": {
      const pairs = insight.params.pairs.map(
        ([l, r]) => `**${poleName(l)}** と **${poleName(r)}**`,
      );
      return {
        rule: "D3",
        text: `${pairs.join("、")}はちょうど半々。場面や相手によって使い分けているようです`,
      };
    }
    case "D4":
      return {
        rule: "D4",
        text: `${joinBold(insight.params.axes.map(axisName))} は意見が割れました。見せている顔が、相手によってちがうのかも`,
      };
    case "D5": {
      const { no, answered, count } = insight.params;
      const head = `${countPhrase(count, answered)}が『${summaryOf(no, version)}』に「そう思う」。`;
      const a = opposingAxis(no, true, version, axes);
      return {
        rule: "D5",
        text: a
          ? `${head}${judged(a)}でも、この場面では **${poleName(QUESTIONS[no - 1].pole)}** の顔がみんなに見えています`
          : `${head}友達の目にもはっきり映っている行動です`,
      };
    }
    case "D6": {
      const { no, answered, count } = insight.params;
      const head = `『${summaryOf(no, version)}』は ${countPhrase(count, answered)}が「ちがう」。`;
      const a = opposingAxis(no, false, version, axes);
      return {
        rule: "D6",
        text: a
          ? `${head}${judged(a)}でも、この行動はあまり見られていないようです`
          : `${head}友達から見ると、あまりしない行動のようです`,
      };
    }
    case "D7": {
      const { no, count } = insight.params;
      return {
        rule: "D7",
        text: `『${summaryOf(no, version)}』は ${count} 人が「わからない」。ここはまだ友達に見せていない一面かも`,
      };
    }
    case "D8": {
      const parts = insight.params.items.map(
        ({ axis, pole }) => `**${axisName(axis)}** は **${poleName(pole)}**`,
      );
      return {
        rule: "D8",
        text: `人数では割れたけど、強く感じている人の声で決まりました：${parts.join("、")}`,
      };
    }
  }
}

export function describeSelfAxis(
  self: SelfAxis,
  othersPole: Pole,
  othersPercent: number,
): string {
  switch (self.gap) {
    case "pole":
      return `自分では **${poleName(self.pole)}** だと思っているけど、周りからは **${poleName(othersPole)}** に見えています。意外な一面が外に出ているのかも`;
    case "stronger":
      return `どちらも **${poleName(self.pole)}** だけど、周りから見たほうが強め（自分 ${self.percent}% → 周り ${othersPercent}%）。自分が思うより強く出ています`;
    case "weaker":
      return `どちらも **${poleName(self.pole)}** だけど、周りから見たほうが控えめ（自分 ${self.percent}% → 周り ${othersPercent}%）。自分が思うより控えめに出ています`;
    case "selfTie":
      return `自分では **どちらとも言えない** と思っているけど、周りからはハッキリ **${poleName(othersPole)}**（${othersPercent}%）に見えています`;
    case "match":
      return `自分の見方と周りの見方がほぼ一致（自分 ${self.percent}% ／ 周り ${othersPercent}%）。自分をよく分かっています`;
  }
}

export function selfSummaryLabel(
  summary: "master" | "gap" | null,
): string | null {
  if (summary === "master") return "自己理解の達人";
  if (summary === "gap") return "ギャップ萌えタイプ";
  return null;
}

export function describeRelations(result: Result): string | null {
  if (result.relations.length === 0) return null;
  const parts = result.relations.map(
    (r) =>
      `${relationLabel(r.relation)}から見ると **${getType(r.type as TypeCode).name}**`,
  );
  const first = result.relations[0].type;
  const allSame = result.relations.every((r) => r.type === first);
  const tail = allSame
    ? "どの場所でも同じ顔。裏表のない人です"
    : "場所によってキャラを使い分けています";
  return `${parts.join("、")}。${tail}`;
}
