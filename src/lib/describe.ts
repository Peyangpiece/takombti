// 保存した結果の数字を、表示する文に組み立てる（仕様書 §7.5・§7.6・§7.7）。
// 文の型はここにまとめ、数字はすべて結果から差し込む。

import { QUESTIONS, type Axis, type Pole } from "../data/questions";
import {
  AXES,
  POLE_LABEL,
  getType,
  relationLabel,
  type TypeCode,
} from "../data/framework";
import type { Insight, Result, SelfAxis } from "./scoring";

function poleName(p: Pole): string {
  return POLE_LABEL[p].name;
}

function axisName(a: Axis): string {
  return AXES.find((x) => x.axis === a)!.name;
}

function summaryOf(no: number): string {
  return QUESTIONS[no - 1].summary;
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

export function describeInsight(insight: Insight): Line {
  switch (insight.rule) {
    case "D1": {
      const { pole, p, N } = insight.params;
      return {
        rule: "D1",
        text: `いちばんハッキリ出たのは **${poleName(pole)}**（${p}%）。${N} 人から見て、ここはあなたの"看板"です`,
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
      return {
        rule: "D5",
        text: `${countPhrase(count, answered)}が『${summaryOf(no)}』に"そう思う"。友達の目にもはっきり映っている行動です`,
      };
    }
    case "D6": {
      const { no, answered, count } = insight.params;
      return {
        rule: "D6",
        text: `『${summaryOf(no)}』は ${countPhrase(count, answered)}が"ちがう"。友達から見ると、あまりしない行動のようです`,
      };
    }
    case "D7": {
      const { no, count } = insight.params;
      return {
        rule: "D7",
        text: `『${summaryOf(no)}』は ${count} 人が"わからない"。ここはまだ友達に見せていない一面かも`,
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
