// 分析の文（仕様書 §7.5）：言い切りすぎない・矛盾して見えないこと
import { describe, expect, it } from "vitest";
import {
  describeInsight,
  describeRelations,
  describeSelfAxis,
  describeTopBehavior,
  fewDataMessage,
  selfSummaryLabel,
} from "../src/lib/describe";
import { isLoose, weakAxes, type AxisResult } from "../src/lib/scoring";

function axis(
  axis: AxisResult["axis"],
  pole: AxisResult["pole"],
  percent: number,
  tie = false,
): AxisResult {
  return {
    axis,
    pole,
    percent,
    strength: "やや",
    agreement: "多数派",
    tie,
  };
}

// Q1「初対面でも自分から話しかける」は A1 の外向（E）の問、Q2「大人数のあとはひとりの時間がほしい」は内向（I）の問
const introvert = [
  axis("A1", "I", 52),
  axis("A2", "S", 58),
  axis("A3", "T", 55),
  axis("A4", "J", 56),
];

describe("D1 の「看板」", () => {
  it("65% 以上なら「看板」と言い切る", () => {
    const t = describeInsight({
      rule: "D1",
      params: { pole: "E", p: 65, N: 4 },
    }).text;
    expect(t).toContain("「看板」");
    // 友達からの見え方として書く（§7.9）
    expect(t).toContain("4 人から見ると");
  });
  it("65% 未満なら言い切らない", () => {
    const t = describeInsight({
      rule: "D1",
      params: { pole: "S", p: 64, N: 4 },
    }).text;
    expect(t).not.toContain("看板");
    expect(t).toContain("どの軸もはっきりとは寄っておらず");
  });
});

describe("D5・D6 が判定と逆向きのとき", () => {
  it("判定は内向なのに、外向の行動に全員が「そう思う」なら、ずれを書く", () => {
    const t = describeInsight(
      { rule: "D5", params: { no: 1, answered: 4, count: 4 } },
      2,
      introvert,
    ).text;
    expect(t).toContain("4 人中 4 人（全員）");
    expect(t).toContain("判定はわずかに**内向**（52%）ですが");
    expect(t).toContain("**外向**の顔");
  });
  it("判定と同じ向きの行動なら、これまでの文", () => {
    const t = describeInsight(
      { rule: "D5", params: { no: 2, answered: 4, count: 4 } },
      2,
      introvert,
    ).text;
    expect(t).toContain("友達の目にもはっきり映っている行動です");
  });
  it("判定は内向なのに、内向の行動に「ちがう」なら、ずれを書く", () => {
    const t = describeInsight(
      { rule: "D6", params: { no: 2, answered: 4, count: 3 } },
      2,
      introvert,
    ).text;
    expect(t).toContain("判定はわずかに**内向**（52%）でも");
  });
  it("外向の行動に「ちがう」は、内向の判定と合うので、これまでの文", () => {
    const t = describeInsight(
      { rule: "D6", params: { no: 1, answered: 4, count: 3 } },
      2,
      introvert,
    ).text;
    expect(t).toContain("あまりしない行動のようです");
  });
  it("55% 以上なら「わずかに」は付けない。ど真ん中の軸と 1 版の結果では、ずれと言わない", () => {
    const strong = [axis("A1", "I", 70), ...introvert.slice(1)];
    const d5 = {
      rule: "D5",
      params: { no: 1, answered: 4, count: 4 },
    } as const;
    expect(describeInsight(d5, 2, strong).text).toContain(
      "判定は**内向**（70%）ですが",
    );
    const tie = [axis("A1", "I", 50, true), ...introvert.slice(1)];
    expect(describeInsight(d5, 2, tie).text).not.toContain("判定は");
    expect(describeInsight(d5, 1, introvert).text).not.toContain("判定は");
  });
});

describe("ゆるめの判定", () => {
  it("どの軸も 65% 未満ならゆるめ。1 つでも 65% 以上ならちがう", () => {
    expect(isLoose(introvert)).toBe(true);
    expect(isLoose([axis("A1", "I", 65), ...introvert.slice(1)])).toBe(false);
  });
});

describe("自分がど真ん中の軸（§7.6）", () => {
  const tie = {
    axis: "A1",
    pole: "I",
    percent: 50,
    tie: true,
    gap: "match",
  } as const;
  it("周りが寄っていれば、以前の決まりで「一致」と保存した結果でも、ずれを書く", () => {
    const t = describeSelfAxis(tie, "E", 67);
    expect(t).not.toContain("一致");
    expect(t).toContain("**外向**寄り（67%）");
    expect(describeSelfAxis(tie, "E", 70)).toContain("ハッキリ**外向**（70%）");
  });
  it("周りもど真ん中なら、両方どちらとも言えないと書く", () => {
    expect(describeSelfAxis(tie, "I", 50)).toContain(
      "どちらとも言えない**（50%）",
    );
  });
  it("ど真ん中の軸がある自己回答には「自己理解の達人」を出さない", () => {
    expect(selfSummaryLabel({ summary: "master", axes: [tie] })).toBeNull();
    expect(
      selfSummaryLabel({ summary: "master", axes: [{ ...tie, tie: false }] }),
    ).toBe("自己理解の達人");
  });
});

describe("入れ替わりやすい軸（§7.2）", () => {
  it("55% 未満の軸に印を付ける。ど真ん中の軸は別の印なので付けない", () => {
    expect(
      weakAxes([
        axis("A1", "I", 52),
        axis("A2", "S", 55),
        axis("A3", "T", 50, true),
        axis("A4", "J", 80),
      ]),
    ).toEqual([true, false, false, false]);
  });
});

describe("周りがちょうど半々の軸（§7.6・版 3）", () => {
  const lean = {
    axis: "A1",
    pole: "E",
    percent: 75,
    tie: false,
    gap: "pole",
  } as const;
  it("周りの判定の印（tie）で見る。仮に決めた極に「見えています」とは言わない", () => {
    // 以前の決まりで gap: "pole" と保存した結果でも
    const t = describeSelfAxis(lean, "I", 50, true);
    expect(t).toContain("**ちょうど半々**（50%）");
    expect(t).toContain("**外向**寄り（75%）");
    expect(t).not.toContain("**内向**に見えています");
  });
  it("四捨五入で 50% でも、周りが半々でなければ、その極で書く", () => {
    const tie = { ...lean, pole: "I", percent: 50, tie: true } as const;
    expect(describeSelfAxis(tie, "E", 50, false)).toContain(
      "**外向**寄り（50%）",
    );
    expect(describeSelfAxis(tie, "E", 50, true)).toContain(
      "どちらとも言えない**（50%）",
    );
  });
  it("周りが半々の軸は、達人にもギャップ萌えにも数えない", () => {
    const pole = { ...lean, gap: "pole" } as const;
    const match = { ...lean, gap: "match" } as const;
    const others = [{ tie: true }, { tie: false }, { tie: false }];
    expect(
      selfSummaryLabel({ summary: "gap", axes: [pole, pole, match] }, others),
    ).toBeNull();
    expect(
      selfSummaryLabel({ summary: "gap", axes: [match, pole, pole] }, others),
    ).toBe("ギャップ萌えタイプ");
    expect(
      selfSummaryLabel(
        { summary: "master", axes: [match, match, match] },
        others,
      ),
    ).toBeNull();
  });
});

describe("D3：全員が真ん中に答えた軸（§7.5）", () => {
  it("使い分けているとは言わず、みんな真ん中寄りと書く", () => {
    const t = describeInsight({
      rule: "D3",
      params: {
        pairs: [
          ["E", "I"],
          ["T", "F"],
        ],
        middle: [true, false],
      },
    }).text;
    expect(t).toContain(
      "**外向**と**内向**はちょうど半々。どちらかに寄ったというより、みんな真ん中寄りに見ています",
    );
    expect(t).toContain(
      "**思考**と**感情**はちょうど半々。友達には、場面や相手によって使い分けているように見えています",
    );
  });
  it("middle のない以前の結果は、これまでの文", () => {
    const t = describeInsight({
      rule: "D3",
      params: { pairs: [["E", "I"]] },
    }).text;
    expect(t).toContain("使い分けている");
  });
});

describe("D5・D6 の「全員」（§7.5）", () => {
  it("答えた友達の全員（N 人）が 1〜7 で答えたときだけ「全員」", () => {
    const d5 = (answered: number, count: number, N?: number, no = 1) =>
      describeInsight({ rule: "D5", params: { no, answered, count, N } }, 3)
        .text;
    expect(d5(4, 4, 4)).toContain("4 人中 4 人（全員）");
    // 1 人が「わからない」なら、答えた人の全員でも「全員」とは言わない
    expect(d5(4, 4, 5)).not.toContain("全員");
    // N のない以前の結果：基本の問なら「全員」、深掘りの問なら言わない
    expect(d5(4, 4)).toContain("（全員）");
    expect(d5(4, 4, undefined, 5)).not.toContain("全員");
  });
});

describe("関係ごとの見え方（§7.7）", () => {
  const result = (
    relations: {
      relation: string;
      count: number;
      type: string;
      clear?: boolean[];
    }[],
  ) =>
    ({
      algorithmVersion: 3,
      n: 6,
      type: "ENFP",
      axes: [],
      insights: [],
      self: null,
      relations,
    }) as unknown as Parameters<typeof describeRelations>[0];
  it("同じタイプなら「同じタイプに見えています」。裏表のない人とは言い切らない", () => {
    const t = describeRelations(
      result([
        { relation: "school", count: 3, type: "ENFP" },
        { relation: "work", count: 3, type: "ENFP" },
      ]),
    )!;
    expect(t).toContain("同じタイプに見えています");
    expect(t).not.toContain("裏表");
  });
  it("ちがう文字の軸が、どちらから見ても「やや」以上のときだけ、ちがいを言う", () => {
    const clear = [true, true, true, true];
    const strong = describeRelations(
      result([
        { relation: "school", count: 3, type: "ENFP", clear },
        { relation: "work", count: 3, type: "INFP", clear },
      ]),
    )!;
    expect(strong).toContain("見せている顔が少しちがうようです");
    const weak = describeRelations(
      result([
        { relation: "school", count: 3, type: "ENFP", clear },
        {
          relation: "work",
          count: 3,
          type: "INFP",
          clear: [false, true, true, true],
        },
      ]),
    )!;
    expect(weak).toContain("はっきり分かれたとは言えません");
    expect(weak).not.toContain("キャラを使い分け");
  });
  it("「その他」は比べない（以前に保存した結果でも）", () => {
    expect(
      describeRelations(
        result([
          { relation: "other", count: 3, type: "ENFP" },
          { relation: "work", count: 3, type: "INFP" },
        ]),
      ),
    ).toBeNull();
  });
});

describe("周りと自分の比較の文（§7.6）", () => {
  const self = (
    pole: AxisResult["pole"],
    percent: number,
    gap: "match" | "stronger" | "weaker" | "pole",
  ) => ({ axis: "A1", pole, percent, tie: false, gap }) as const;
  it("文頭に軸を「外向／内向：」の形で書く", () => {
    expect(describeSelfAxis(self("I", 54, "match"), "I", 56)).toMatch(
      /^外向／内向：/,
    );
  });
  it("同じ向きで差が 5 ポイント以下なら「ほぼ同じ」。それより大きければ「少し強め・少し控えめ」", () => {
    expect(describeSelfAxis(self("I", 54, "match"), "I", 59)).toContain(
      "ほぼ同じ見え方です",
    );
    const t = describeSelfAxis(self("I", 54, "match"), "I", 65);
    expect(t).toContain("自分も周りも**内向**（自分 54%・周り 65%）");
    expect(t).toContain("周りから見たほうが少し強めです");
    expect(t).not.toContain("一致");
    expect(describeSelfAxis(self("I", 70, "match"), "I", 58)).toContain(
      "少し控えめです",
    );
  });
  it("自分を分かっている・いないとは言い切らない", () => {
    for (const gap of ["match", "stronger", "weaker", "pole"] as const)
      expect(describeSelfAxis(self("I", 60, gap), "I", 61)).not.toContain(
        "分かっています",
      );
  });
  it("強め・控えめ・極のずれも、軸と両方の割合を書く", () => {
    expect(describeSelfAxis(self("I", 55, "stronger"), "I", 80)).toBe(
      "外向／内向：自分も周りも**内向**。周りから見たほうが強めに出ています（自分 55%・周り 80%）",
    );
    expect(describeSelfAxis(self("I", 60, "pole"), "E", 58)).toBe(
      "外向／内向：自分では**内向**（60%）、周りからは**外向**（58%）に見えています。意外な一面が外に出ているのかも",
    );
  });
});

describe("D8・D4 は画面に出ている極の名前で書く（§7.5）", () => {
  it("D8：軸を「思考／感情」と書き、決まった極を書く", () => {
    const t = describeInsight({
      rule: "D8",
      params: { items: [{ axis: "A3", pole: "F" }] },
    }).text;
    expect(t).toBe(
      "**思考／感情**は友達の意見が割れました。**感情**だとはっきり答えた人がいたぶん、判定は**感情**です",
    );
    expect(t).not.toContain("判断");
  });
  it("D4（以前の結果）も軸名を使わない", () => {
    const t = describeInsight({ rule: "D4", params: { axes: ["A1"] } }).text;
    expect(t).toContain("**外向／内向**は、友達の意見が分かれました");
    expect(t).not.toContain("エネルギー");
  });
  it("太字の前後に半角の空きを入れない", () => {
    const lines = [
      describeInsight({ rule: "D1", params: { pole: "E", p: 70, N: 5 } }),
      describeInsight({ rule: "D2", params: { poles: ["E", "S"], N: 5 } }),
      describeInsight({
        rule: "D3",
        params: { pairs: [["E", "I"]], middle: [false] },
      }),
      describeInsight(
        { rule: "D5", params: { no: 1, answered: 4, count: 4 } },
        2,
        introvert,
      ),
    ].map((l) => l.text);
    for (const t of lines) expect(t).not.toMatch(/ \*\*|\*\* /);
  });
});

describe("友達の多くがうなずいた行動の 1 行（§4.11・§7.5）", () => {
  const b = { no: 1, summary: "x", answered: 4, agree: 4 };
  it("人数の言い方は D5 と同じ（全員なら「全員」と添える）", () => {
    expect(describeTopBehavior(b, 4).count).toBe(
      "4 人中 4 人（全員）が「そう思う」",
    );
    expect(describeTopBehavior(b, 5).count).toBe("4 人中 4 人が「そう思う」");
  });
  it("判定と逆向きの行動なら、ずれの一言を添える", () => {
    expect(describeTopBehavior(b, 4, introvert).note).toContain(
      "判定はわずかに**内向**（52%）ですが",
    );
    expect(describeTopBehavior({ ...b, no: 2 }, 4, introvert).note).toBeNull();
  });
});

describe("人数が少ないときの説明（§4.11）", () => {
  const d1 = { rule: "D1", params: { pole: "E", p: 70, N: 3 } } as const;
  const top = [{ no: 1, summary: "x", answered: 3, agree: 3 }];
  it("当てはまらなければ出さない", () => {
    expect(
      fewDataMessage(
        6,
        [d1, { rule: "D7", params: { no: 1, count: 3 } }],
        top,
        false,
      ),
    ).toBeNull();
  });
  it("問ごとの分析が何も出ていなければ、出せないことがあると書く", () => {
    expect(fewDataMessage(3, [d1], [], false)).toContain(
      "質問ごとの分析を出せないことがあります",
    );
  });
  it("うなずいた行動などが出ていれば、食いちがわないよう短い一言だけ", () => {
    const t = fewDataMessage(3, [d1], top, false);
    expect(t).toBe("人数が多いほど、出せる分析がふえます（いまは 3 人分）。");
    expect(fewDataMessage(3, [d1], [], true)).toBe(t);
  });
});
