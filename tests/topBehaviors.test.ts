// 無料の結果の「友達の多くがうなずいた行動」と、人数が少ないときの説明（仕様書 §4.11・§7.5・§8.5）
import { describe, expect, it } from "vitest";
import {
  computeResult,
  fewDataNote,
  MAX_TOP_BEHAVIORS,
  NOT_ASKED,
  topBehaviors,
  UNKNOWN,
  type Insight,
} from "../src/lib/scoring";
import { QUESTIONS } from "../src/data/questions";

const NA = NOT_ASKED;
// 基本の問はすべて 4（どちらとも）、深掘りの問は出していない回答
const base = (): number[] =>
  QUESTIONS.map((q) => (q.stage === "core" ? 4 : NA));
// base に、問の番号ごとの答えを入れる
function row(values: Record<number, number>): number[] {
  const r = base();
  for (const [no, v] of Object.entries(values)) r[Number(no) - 1] = v;
  return r;
}
const nos = (list: { no: number }[]) => list.map((b) => b.no);

describe("友達の多くがうなずいた行動：選び方", () => {
  it("「そう思う」（5 以上）が 3 分の 2 以上の問だけ", () => {
    const list = [
      row({ 1: 6, 2: 6, 3: 5 }),
      row({ 1: 7, 2: 3, 3: 4 }),
      row({ 1: 3, 2: 2, 3: 5 }),
    ];
    // Q1 は 3 人中 2 人（ちょうど 3 分の 2）、Q2 は 1 人、Q3 は 2 人
    const top = topBehaviors(list);
    expect(nos(top)).toEqual([1, 3]);
    expect(top[0]).toEqual({
      no: 1,
      summary: QUESTIONS[0].summary,
      answered: 3,
      agree: 2,
    });
  });

  it("「わからない」の人は分母に入れない。1〜7 で答えた人が 3 人未満の問は出さない", () => {
    const list = [
      row({ 1: 6, 2: 6 }),
      row({ 1: 6, 2: 6 }),
      row({ 1: 6, 2: UNKNOWN }),
      row({ 1: UNKNOWN, 2: UNKNOWN }),
    ];
    const top = topBehaviors(list);
    // Q1 は 3 人中 3 人。Q2 は 1〜7 で答えたのが 2 人なので出さない
    expect(top.find((b) => b.no === 1)).toMatchObject({
      answered: 3,
      agree: 3,
    });
    expect(nos(top)).not.toContain(2);
  });

  it("1〜7 で答えた人が、答えた友達の半分以上の問だけ（深掘りの問）", () => {
    const follow = QUESTIONS.find((q) => q.stage === "follow")!.no;
    const asked = () => row({ [follow]: 7 });
    // 6 人中 3 人が答えた深掘りの問は出す。7 人中 3 人なら出さない
    const six = [asked(), asked(), asked(), base(), base(), base()];
    expect(nos(topBehaviors(six))).toContain(follow);
    const seven = [...six, base()];
    expect(nos(topBehaviors(seven))).not.toContain(follow);
  });

  it("割合の高い順に最大 3 つ。同じ割合なら番号の若い順", () => {
    // Q9：3/3、Q2：3/3、Q4：2/3、Q1：2/3、Q3：2/3
    const list = [
      row({ 9: 6, 2: 6, 4: 6, 1: 6, 3: 6 }),
      row({ 9: 6, 2: 6, 4: 6, 1: 6, 3: 6 }),
      row({ 9: 6, 2: 6, 4: 1, 1: 1, 3: 1 }),
    ];
    const top = topBehaviors(list);
    expect(top).toHaveLength(MAX_TOP_BEHAVIORS);
    expect(nos(top)).toEqual([2, 9, 1]);
  });

  it("割合は人数でなく比で比べる（4 人中 3 人より、3 人中 3 人が先）", () => {
    const list = [
      row({ 1: 6, 2: 6 }),
      row({ 1: 6, 2: 6 }),
      row({ 1: 6, 2: 6 }),
      row({ 1: 2, 2: UNKNOWN }),
    ];
    expect(nos(topBehaviors(list))).toEqual([2, 1]);
  });

  it("人数をふやして出し直したとき、1〜2 人しか増えていない問は出さない（itemSafety と同じ）", () => {
    const first = [
      row({ 1: 6, 2: 6 }),
      row({ 1: 6, 2: 6 }),
      row({ 1: 6, 2: 6 }),
    ];
    // あとの 3 人のうち 2 人は Q1 に「わからない」→ Q1 は 3 → 4 人（差 1）。Q2 は 3 → 6 人（差 3）
    const added = [
      row({ 1: 6, 2: 6 }),
      row({ 1: UNKNOWN, 2: 6 }),
      row({ 1: UNKNOWN, 2: 6 }),
    ];
    const all = [...first, ...added];
    expect(nos(topBehaviors(all, [3]))).toEqual([2]);
    // 前の結果がなければ、Q1 も出せる
    expect(nos(topBehaviors(all))).toEqual([1, 2]);
    // 前の結果と同じ数（差 0）の問は出せる
    const same = [
      ...first,
      row({ 1: UNKNOWN, 2: 6 }),
      row({ 1: UNKNOWN, 2: 6 }),
      row({ 1: UNKNOWN, 2: 6 }),
    ];
    expect(nos(topBehaviors(same, [3]))).toEqual([1, 2]);
    // いまの回答の数と同じ境目（いま出した結果そのもの）は、差に使わない
    expect(nos(topBehaviors(all, [6]))).toEqual([1, 2]);
  });

  it("1 つめは、データでわかるあなたの D5 と同じ問", () => {
    const list = [
      row({ 3: 7, 5: 6, 7: 6 }),
      row({ 3: 6, 5: 6, 7: 2 }),
      row({ 3: 2, 5: 6, 7: 6 }),
      row({ 3: 6, 5: 1, 7: 6 }),
    ].map((r) => QUESTIONS.map((q, i) => (q.stage === "core" ? r[i] : 4)));
    const res = computeResult(
      list.map((answers) => ({ answers })),
      null,
    );
    const d5 = res.insights.find((i) => i.rule === "D5");
    const top = topBehaviors(list);
    expect(d5).toBeDefined();
    expect(top[0].no).toBe((d5!.params as { no: number }).no);
  });

  it("送るのは、問の番号・要約・答えた人数・「そう思う」の人数だけ", () => {
    const list = [row({ 1: 6 }), row({ 1: 7 }), row({ 1: 5 })];
    for (const b of topBehaviors(list))
      expect(Object.keys(b).sort()).toEqual([
        "agree",
        "answered",
        "no",
        "summary",
      ]);
  });

  it("当てはまる問がなければ空", () => {
    expect(topBehaviors([base(), base(), base()])).toEqual([]);
  });
});

describe("人数が少ないときの説明", () => {
  const d5: Insight = {
    rule: "D5",
    params: { no: 1, answered: 5, count: 5, N: 5 },
  };
  const d1: Insight = { rule: "D1", params: { pole: "E", p: 70, N: 5 } };
  const one = [{ no: 1, summary: "x", answered: 5, agree: 5 }];

  it("4 人以下なら出す", () => {
    expect(fewDataNote(3, [d1, d5], one, true)).toBe(true);
    expect(fewDataNote(4, [d1, d5], one, true)).toBe(true);
    expect(fewDataNote(5, [d1, d5], one, true)).toBe(false);
  });
  it("うなずいた行動が 1 つもなければ出す。作らない結果（null）では数えない", () => {
    expect(fewDataNote(5, [d1, d5], [], true)).toBe(true);
    expect(fewDataNote(5, [d1, d5], null, false)).toBe(false);
  });
  it("問ごとの文（D5〜D7）も関係ごとの見え方もなければ出す", () => {
    expect(fewDataNote(6, [d1], one, false)).toBe(true);
    expect(fewDataNote(6, [d1], one, true)).toBe(false);
    for (const rule of ["D6", "D7"] as const) {
      const ins =
        rule === "D6"
          ? ({ rule, params: { no: 2, answered: 6, count: 5 } } as Insight)
          : ({ rule, params: { no: 2, count: 3 } } as Insight);
      expect(fewDataNote(6, [d1, ins], one, false)).toBe(false);
    }
  });
});
