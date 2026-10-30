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
  UNCOMPARED_RELATIONS,
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

// 人数の言い方（§7.5）：答えた友達の全員（N 人全員が 1〜7 で答え、全員が同じ答え）なら「全員」と添える。それ以外は人数だけ。
// N を持たない以前の結果は、だれにも出る基本の問のときだけ、答えた人の全員で「全員」と言う
// （深掘りの問は一部の人にしか出ないので、答えた人の全員でも、友達の全員とは言えない）
function countPhrase(
  count: number,
  answered: number,
  no: number,
  version: number,
  n: number | undefined,
): string {
  const everyone =
    n !== undefined
      ? count === answered && answered === n
      : count === answered &&
        version !== 1 &&
        QUESTIONS[no - 1].stage === "core";
  if (everyone) return `${answered} 人中 ${count} 人（全員）`;
  return `${answered} 人中 ${count} 人`;
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
      const { pairs, middle } = insight.params;
      const name = ([l, r]: [Pole, Pole]) =>
        `**${poleName(l)}** と **${poleName(r)}**`;
      // 全員がちょうど真ん中に答えた軸は、使い分けているのではなく、みんな真ん中寄りに見ている（§7.5）
      const still = pairs.filter((_, i) => middle?.[i]).map(name);
      const mixed = pairs.filter((_, i) => !middle?.[i]).map(name);
      const parts: string[] = [];
      if (mixed.length > 0)
        parts.push(
          `${mixed.join("、")}はちょうど半々。場面や相手によって使い分けているようです`,
        );
      if (still.length > 0)
        parts.push(
          `${still.join("、")}はちょうど半々。どちらかに寄ったというより、みんな真ん中寄りに見ています`,
        );
      return { rule: "D3", text: parts.join("。") };
    }
    case "D4":
      return {
        rule: "D4",
        text: `${joinBold(insight.params.axes.map(axisName))} は意見が割れました。見せている顔が、相手によってちがうのかも`,
      };
    case "D5": {
      const { no, answered, count, N } = insight.params;
      const head = `${countPhrase(count, answered, no, version, N)}が『${summaryOf(no, version)}』に「そう思う」。`;
      const a = opposingAxis(no, true, version, axes);
      return {
        rule: "D5",
        text: a
          ? `${head}${judged(a)}でも、この場面では **${poleName(QUESTIONS[no - 1].pole)}** の顔がみんなに見えています`
          : `${head}友達の目にもはっきり映っている行動です`,
      };
    }
    case "D6": {
      const { no, answered, count, N } = insight.params;
      const head = `『${summaryOf(no, version)}』は ${countPhrase(count, answered, no, version, N)}が「ちがう」。`;
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

// othersTie：周りの判定がちょうど半々か（結果の axes[].tie）。渡さないときは、割合が 50% かで見る（以前の呼び方）
export function describeSelfAxis(
  self: SelfAxis,
  othersPole: Pole,
  othersPercent: number,
  othersTie: boolean = othersPercent === 50,
): string {
  // 自分がど真ん中の軸。保存した結果の gap によらず、周りの判定から言い方を決める（以前の決まりで保存した結果も同じに見せる）
  if (self.tie) {
    if (othersTie)
      return `自分でも周りから見ても **どちらとも言えない**（50%）。場面によって両方の顔が出ているようです`;
    const seen =
      othersPercent >= 70
        ? `ハッキリ **${poleName(othersPole)}**（${othersPercent}%）`
        : `**${poleName(othersPole)}** 寄り（${othersPercent}%）`;
    return `自分では **どちらとも言えない** と思っているけど、周りからは${seen}に見えています`;
  }
  // 周りがちょうど半々の軸。§6.4 で決めた極は仮のものなので、保存した gap によらず「周りからは〜に見えている」とは言わない
  if (othersTie)
    return `自分では **${poleName(self.pole)}** 寄り（${self.percent}%）だと思っているけど、周りから見ると **ちょうど半々**（50%）。両方の顔が見えているようです`;
  switch (self.gap) {
    case "pole":
      return `自分では **${poleName(self.pole)}** だと思っているけど、周りからは **${poleName(othersPole)}** に見えています。意外な一面が外に出ているのかも`;
    case "stronger":
      return `どちらも **${poleName(self.pole)}** だけど、周りから見たほうが強め（自分 ${self.percent}% → 周り ${othersPercent}%）。自分が思うより強く出ています`;
    case "weaker":
      return `どちらも **${poleName(self.pole)}** だけど、周りから見たほうが控えめ（自分 ${self.percent}% → 周り ${othersPercent}%）。自分が思うより控えめに出ています`;
    case "selfTie": // 自分がど真ん中のときだけの値なので、上で返している
    case "othersTie": // 周りがど真ん中のときだけの値なので、上で返している
    case "match":
      return `自分の見方と周りの見方がほぼ一致（自分 ${self.percent}% ／ 周り ${othersPercent}%）。自分をよく分かっています`;
  }
}

// others：周りの判定（結果の axes）。渡すと、周りがちょうど半々の軸を、達人にもギャップにも数えない
// （以前の決まりで保存した結果は、周りが半々の軸でも、仮に決めた極とのずれを「極がちがう」と数えていたため）
export function selfSummaryLabel(
  self: {
    summary: "master" | "gap" | null;
    axes: { tie: boolean; gap?: SelfAxis["gap"] }[];
  },
  others?: { tie: boolean }[],
): string | null {
  const { summary } = self;
  const othersTie = (i: number) => Boolean(others?.[i]?.tie);
  // ど真ん中の軸がある自己回答は「達人」と言わない（以前の決まりで保存した結果にも当てはめる）
  if (summary === "master")
    return self.axes.some((a, i) => a.tie || othersTie(i))
      ? null
      : "自己理解の達人";
  if (summary === "gap") {
    if (!others) return "ギャップ萌えタイプ";
    const poles = self.axes.filter(
      (a, i) => a.gap === "pole" && !othersTie(i),
    ).length;
    return poles >= 2 ? "ギャップ萌えタイプ" : null;
  }
  return null;
}

// §7.7：関係ごとの見え方。「その他」は比べない（以前に保存した結果にも当てはめる）。
// ちがいを言い切るのは、タイプの文字がちがう軸のうち、どちらの関係から見ても「やや」（55%）以上に寄っている軸があるときだけ。
// ほぼ半々の軸は、少しの差で文字が入れかわるため
export function describeRelations(result: Result): string | null {
  const list = result.relations.filter(
    (r) => !UNCOMPARED_RELATIONS.includes(r.relation),
  );
  if (list.length < 2) return null;
  const parts = list.map(
    (r) =>
      `${relationLabel(r.relation)}から見ると **${getType(r.type as TypeCode).name}**`,
  );
  const first = list[0].type;
  if (list.every((r) => r.type === first))
    return `${parts.join("、")}。どの関係から見ても、同じタイプに見えています`;
  // 2 つの関係で、文字がちがい、どちらから見ても「やや」以上の軸があるか
  const clearDiff = (
    a: (typeof list)[number],
    b: (typeof list)[number],
  ): boolean | null => {
    if (!a.clear || !b.clear) return null;
    return [0, 1, 2, 3].some(
      (i) => a.type[i] !== b.type[i] && a.clear![i] && b.clear![i],
    );
  };
  let known = true;
  let differs = false;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const d = clearDiff(list[i], list[j]);
      if (d === null) known = false;
      else if (d) differs = true;
    }
  const tail = differs
    ? "関係によって、見せている顔が少しちがうようです"
    : known
      ? "タイプはちがって見えますが、ちがうのはほぼ半々の軸で、はっきり分かれたとは言えません"
      : "関係によってタイプがちがって見えています（ほぼ半々の軸は、少しの差で文字が入れかわることもあります）";
  return `${parts.join("、")}。${tail}`;
}
