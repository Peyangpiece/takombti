// 分析の文（仕様書 §7.5）：言い切りすぎない・矛盾して見えないこと
import { describe, expect, it } from "vitest";
import {
  describeInsight,
  describeSelfAxis,
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
  });
  it("65% 未満なら言い切らない", () => {
    const t = describeInsight({
      rule: "D1",
      params: { pole: "S", p: 64, N: 4 },
    }).text;
    expect(t).not.toContain("看板");
    expect(t).toContain("どの軸も強くは出ておらず");
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
    expect(t).toContain("判定はわずかに **内向**（52%）でも");
    expect(t).toContain("**外向** の顔");
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
    expect(t).toContain("判定はわずかに **内向**（52%）でも");
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
      "判定は **内向**（70%）でも",
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
    expect(t).toContain("**外向** 寄り（67%）");
    expect(describeSelfAxis(tie, "E", 70)).toContain(
      "ハッキリ **外向**（70%）",
    );
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
