// 判定の計算と分析の材料（仕様書 §6・§7・§14）
import { describe, expect, it } from "vitest";
import {
  computeResult,
  leftPercent,
  needsFollowUp,
  NOT_ASKED,
  plannedQuestions,
  raterAxisScore,
  validateAnswers,
  incompleteAxes,
  UNKNOWN,
} from "../src/lib/scoring";
import { CORE_ORDER, FOLLOW_ORDER, QUESTIONS } from "../src/data/questions";
import { AXES, POLE_LABEL } from "../src/data/framework";

const NA = NOT_ASKED;

// 深掘りの問を §3.5 の決まりどおりにそろえる：深掘りする軸は follow（なければ 4）、しない軸は NOT_ASKED
function complete(ans: number[], follow?: Record<number, number>): number[] {
  const out = [...ans];
  for (const q of QUESTIONS) {
    if (q.stage !== "follow") continue;
    out[q.no - 1] = needsFollowUp(ans, q.axis)
      ? (follow?.[q.no] ?? (ans[q.no - 1] === NA ? 4 : ans[q.no - 1]))
      : NA;
  }
  return out;
}

// 全問 v（左右の極が同じ数なので、どの軸も半々 → 32 問すべてに答える）
const all = (v: number) => Array(QUESTIONS.length).fill(v);

// 左の極向きの問に l、右の極向きの問に r を入れた回答（axes 以外の軸は 4）
function byPole(l: number, r: number, axes = ["A1", "A2", "A3", "A4"]) {
  return complete(
    QUESTIONS.map((q) => {
      if (!axes.includes(q.axis)) return 4;
      const left = AXES.find((a) => a.axis === q.axis)!.left;
      return q.pole === left ? l : r;
    }),
  );
}

// A1 の 8 問（基本 Q1〜Q4・深掘り Q5〜Q8。E・I・E・I の順）を指定し、ほかは 4
function a1(vals: number[]) {
  const ans = all(4);
  vals.forEach((v, i) => (ans[i] = v));
  return complete(ans);
}

describe("質問", () => {
  it("各軸 8 問。基本 4 問・深掘り 4 問で、それぞれ両方の極に 2 問ずつ", () => {
    for (const { axis, left, right } of AXES) {
      for (const stage of ["core", "follow"]) {
        const qs = QUESTIONS.filter(
          (q) => q.axis === axis && q.stage === stage,
        );
        expect(qs).toHaveLength(4);
        expect(qs.filter((q) => q.pole === left)).toHaveLength(2);
        expect(qs.filter((q) => q.pole === right)).toHaveLength(2);
      }
    }
  });
  it("番号は 1 から順。出す順は基本・深掘りをそれぞれ 1 回ずつ含む", () => {
    QUESTIONS.forEach((q, i) => expect(q.no).toBe(i + 1));
    const core = QUESTIONS.filter((q) => q.stage === "core").map((q) => q.no);
    const follow = QUESTIONS.filter((q) => q.stage === "follow").map(
      (q) => q.no,
    );
    expect([...CORE_ORDER].sort((a, b) => a - b)).toEqual(core);
    expect([...FOLLOW_ORDER].sort((a, b) => a - b)).toEqual(follow);
    // 4 つの軸を順に回す
    CORE_ORDER.forEach((no, i) =>
      expect(QUESTIONS[no - 1].axis).toBe(`A${(i % 4) + 1}`),
    );
  });
});

describe("T-1 §6.9 の計算例", () => {
  const r1 = a1([7, 2, 6, 3]); // +3 +2 +2 +1 = +8（4 問）→ 深掘りなし → 8×840÷4 = 1680
  const r2 = a1([5, 4, UNKNOWN, 3, 5, 3, 4, 5]); // 基本 +2（3 問）→ 深掘り → +3（7 問）→ 360
  const r3 = a1([3, 5, 4, 6]); // −1 −1 0 −2 = −4（4 問）→ 深掘りなし → −840
  it("1 人の点と深掘りの有無", () => {
    expect(r1.slice(4, 8)).toEqual([NA, NA, NA, NA]);
    expect(r2.slice(4, 8)).toEqual([5, 3, 4, 5]);
    expect(r3.slice(4, 8)).toEqual([NA, NA, NA, NA]);
    expect(raterAxisScore(r1, "A1")).toBe(1680);
    expect(raterAxisScore(r2, "A1")).toBe(360);
    expect(raterAxisScore(r3, "A1")).toBe(-840);
  });
  it("E・58%・多数派", () => {
    const res = computeResult(
      [r1, r2, r3].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({
      pole: "E",
      percent: 58,
      strength: "やや",
      agreement: "多数派",
      tie: false,
      sum: 1200,
    });
  });
});

describe("§3.5 答えによって出す問が変わる", () => {
  it("基本の 16 問に答え終わるまでは、基本の問だけ", () => {
    const draft: (number | null)[] = Array(QUESTIONS.length).fill(null);
    expect(plannedQuestions(draft)).toEqual(CORE_ORDER);
    CORE_ORDER.slice(0, 15).forEach((no) => (draft[no - 1] = 4));
    expect(plannedQuestions(draft)).toEqual(CORE_ORDER);
  });
  it("ハッキリした軸は深掘りしない（16 問）", () => {
    expect(plannedQuestions(byPole(7, 1))).toEqual(CORE_ORDER);
  });
  it("半々に近い軸だけ深掘りする", () => {
    const ans = byPole(7, 1, ["A1", "A2", "A3"]);
    expect(plannedQuestions(ans)).toEqual([...CORE_ORDER, 29, 30, 31, 32]);
  });
  it("全部の軸が半々なら 32 問", () => {
    expect(plannedQuestions(all(4))).toHaveLength(32);
  });
  it("「わからない」で基本の問が 3 問未満なら深掘りする", () => {
    const ans = byPole(7, 1);
    ans[0] = UNKNOWN;
    ans[1] = UNKNOWN;
    expect(needsFollowUp(ans, "A1")).toBe(true);
  });
  it("平均がちょうど ±1 ならハッキリ、それより小さければ深掘り", () => {
    expect(needsFollowUp(a1([5, 3, 5, 3]), "A1")).toBe(false); // +4（4 問）
    expect(needsFollowUp(a1([5, 3, 5, 4]), "A1")).toBe(true); // +3（4 問）
  });
});

describe("T-2〜T-4", () => {
  it("T-2 全員が全問 4 → INFP、全軸ど真ん中", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: all(4) })),
      null,
    );
    expect(res.type).toBe("INFP");
    expect(res.axes.every((a) => a.tie && a.percent === 50)).toBe(true);
  });
  it("T-3 全員が全問 7 → 黙従傾向は結果を動かさず、全軸ど真ん中", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: all(7) })),
      null,
    );
    expect(res.axes.every((a) => a.tie && a.sum === 0)).toBe(true);
    expect(res.type).toBe("INFP");
  });
  it("T-4 左向きに 7・右向きに 1 → ESTJ・100%・満場一致", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: byPole(7, 1) })),
      null,
    );
    expect(res.type).toBe("ESTJ");
    for (const a of res.axes) {
      expect(a).toMatchObject({
        percent: 100,
        strength: "振り切れ",
        agreement: "満場一致",
      });
    }
  });
  it("逆向き → INFP・100%", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: byPole(1, 7) })),
      null,
    );
    expect(res.type).toBe("INFP");
    expect(res.axes.every((a) => a.percent === 100)).toBe(true);
  });
});

describe("§6.4 ちょうど半々のときの決め方", () => {
  // a1([7,4,4,4]) は基本が +3（4 問）で半々に近いので深掘りし、+3（8 問）→ 3×840÷8 = +315
  const plus = a1([7, 4, 4, 4]);
  const minus = a1([1, 4, 4, 4]);
  const zero = a1([4, 4, 4, 4]);
  it("手順 1：向きの人数が多いほう", () => {
    // +315・+315・−630（Q1=1 と Q5=1 で −3 が 2 つ）→ 合計 0、正が 2 人
    const res = computeResult(
      [plus, plus, a1([1, 4, 4, 4, 1, 4, 4, 4])].map((answers) => ({
        answers,
      })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", tie: true, percent: 50 });
  });
  it("手順 2：自己回答の向き", () => {
    const res = computeResult(
      [plus, minus, zero].map((answers) => ({ answers })),
      a1([7, 1, 7, 1]),
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", tie: true });
  });
  it("手順 3：強い答え（±3）だけの合計", () => {
    // +315（+3 が 1 つ）と −315（−1 が 3 つ）→ 強い答えの合計は +3
    const res = computeResult(
      [plus, a1([3, 5, 3, 4]), zero].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", tie: true });
  });
  it("手順 4：それでも決まらなければ右の極", () => {
    const res = computeResult(
      [plus, plus, minus, minus, zero].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "I", tie: true });
  });
});

describe("§6.5 一致の度合い", () => {
  const e = a1([7, 1, 7, 1]);
  const i = a1([1, 7, 1, 7]);
  it("4 人中 3 人 → ほぼ一致", () => {
    const res = computeResult(
      [e, e, e, i].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", agreement: "ほぼ一致" });
  });
  it("5 人中 3 人 → 多数派", () => {
    const res = computeResult(
      [e, e, e, i, i].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", agreement: "多数派" });
  });
  it("少数が強く答えた → 意見が割れた・D8", () => {
    const weakI = a1([4, 5, 4, 4]); // −1（深掘りして 8 問）→ −105
    const res = computeResult(
      [e, weakI, weakI, weakI].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", agreement: "意見が割れた" });
    expect(res.insights.some((x) => x.rule === "D8")).toBe(true);
    expect(res.insights.some((x) => x.rule === "D4")).toBe(false);
  });
});

describe("§6.3 割合の丸め", () => {
  it("左右で対称", () => {
    for (let n = 1; n <= 30; n++) {
      for (let x = -2520 * n; x <= 2520 * n; x += 37) {
        expect(leftPercent(x, n) + leftPercent(-x, n)).toBe(100);
      }
    }
  });
  it("範囲は 0〜100", () => {
    expect(leftPercent(2520 * 3, 3)).toBe(100);
    expect(leftPercent(-2520 * 3, 3)).toBe(0);
  });
});

describe("T-5 回答の確かめ", () => {
  it("1 つの軸で答えた問が 3 問未満 → 送れない", () => {
    const ans = all(5);
    [1, 2, 3, 4, 5, 6].forEach((no) => (ans[no - 1] = UNKNOWN));
    expect(validateAnswers(ans, { allowUnknown: true })).not.toBeNull();
    expect(incompleteAxes(ans)).toEqual(["A1"]);
  });
  it("3 問なら送れる", () => {
    const ans = all(5);
    [1, 2, 3, 4, 5].forEach((no) => (ans[no - 1] = UNKNOWN));
    expect(validateAnswers(ans, { allowUnknown: true })).toBeNull();
  });
  it("出すべき深掘りの問を飛ばした回答・出していない問に答えた回答は送れない", () => {
    const skipped = all(4);
    skipped[4] = NA;
    expect(validateAnswers(skipped, { allowUnknown: true })).not.toBeNull();
    const extra = byPole(7, 1);
    extra[4] = 7;
    expect(validateAnswers(extra, { allowUnknown: true })).not.toBeNull();
    expect(validateAnswers(byPole(7, 1), { allowUnknown: true })).toBeNull();
  });
  it("基本の問は「出していない」にできない", () => {
    const ans = byPole(7, 1);
    ans[0] = NA;
    expect(validateAnswers(ans, { allowUnknown: true })).not.toBeNull();
  });
  it("自己回答は「わからない」不可", () => {
    const ans = all(5);
    ans[0] = UNKNOWN;
    expect(validateAnswers(ans, { allowUnknown: false })).not.toBeNull();
  });
  it("形のおかしい回答", () => {
    expect(
      validateAnswers(all(5).slice(1), { allowUnknown: true }),
    ).not.toBeNull();
    expect(
      validateAnswers([...all(5).slice(1), 8], { allowUnknown: true }),
    ).not.toBeNull();
    expect(
      validateAnswers([...all(5).slice(1), 2.5], { allowUnknown: true }),
    ).not.toBeNull();
    expect(validateAnswers("x", { allowUnknown: true })).not.toBeNull();
  });
});

describe("T-14 §7.5 データでわかるあなた", () => {
  it("D1 は必ずあり、最も強い軸", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: byPole(7, 1, ["A3"]) })),
      null,
    );
    expect(res.insights[0]).toEqual({
      rule: "D1",
      params: { pole: "T", p: 100, N: 3 },
    });
  });
  it("D2 満場一致", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: byPole(7, 1, ["A1"]) })),
      null,
    );
    expect(res.insights).toContainEqual({
      rule: "D2",
      params: { poles: ["E"], N: 3 },
    });
  });
  it("D3 ど真ん中（全部の軸が半々なら D1 は出さない）", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: all(4) })),
      null,
    );
    expect(res.insights.some((x) => x.rule === "D1")).toBe(false);
    expect(res.insights.filter((x) => x.rule === "D3")).toEqual([
      {
        rule: "D3",
        params: {
          pairs: [
            ["E", "I"],
            ["S", "N"],
            ["T", "F"],
            ["J", "P"],
          ],
        },
      },
    ]);
  });
  it("D5・D6・D7 と最大 6 つ", () => {
    const raw = all(4);
    raw[0] = 7; // Q1（E）全員そう思う
    raw[1] = 1; // Q2（I）全員ちがう
    const base = complete(raw);
    const withUnknown = [...base];
    withUnknown[11] = UNKNOWN; // Q12 3 人中 2 人わからない
    const res = computeResult(
      [{ answers: withUnknown }, { answers: withUnknown }, { answers: base }],
      null,
    );
    expect(res.insights).toContainEqual({
      rule: "D5",
      params: { no: 1, answered: 3, count: 3 },
    });
    expect(res.insights).toContainEqual({
      rule: "D6",
      params: { no: 2, answered: 3, count: 3 },
    });
    expect(res.insights.length).toBeLessThanOrEqual(6);
  });
  it("D5 は 3 分の 2 未満なら出ない", () => {
    const yes = all(4);
    yes[0] = 7;
    const res = computeResult(
      [{ answers: complete(yes) }, { answers: all(4) }, { answers: all(4) }],
      null,
    );
    expect(res.insights.some((x) => x.rule === "D5")).toBe(false);
  });
  it("D7 わからないが半数以上", () => {
    const u = all(4);
    u[11] = UNKNOWN;
    const res = computeResult(
      [{ answers: u }, { answers: u }, { answers: byPole(7, 1, ["A1"]) }],
      null,
    );
    expect(res.insights).toContainEqual({
      rule: "D7",
      params: { no: 12, count: 2 },
    });
  });
  it("D5〜D7 は、その問を 3 人以上に出したときだけ（だれの答えか分からないように）", () => {
    // Q5（A1 の深掘り）は 3 人目にしか出ていない
    const strong = byPole(7, 1, ["A1"]);
    const deep = a1([7, 4, 4, 4, 7, 4, 4, 4]);
    const res = computeResult(
      [{ answers: strong }, { answers: strong }, { answers: deep }],
      null,
    );
    expect(
      res.insights.some(
        (x) => (x.rule === "D5" || x.rule === "D6") && x.params.no === 5,
      ),
    ).toBe(false);
  });
});

describe("§7.6 自分 vs 周り", () => {
  it("極がちがう・達人・ギャップ萌え", () => {
    const others = [1, 2, 3].map(() => ({ answers: byPole(7, 1) }));
    const gap = computeResult(others, byPole(1, 7));
    expect(gap.self!.type).toBe("INFP");
    expect(gap.self!.axes.every((a) => a.gap === "pole")).toBe(true);
    expect(gap.self!.summary).toBe("gap");
    const same = computeResult(others, byPole(7, 1));
    expect(same.self!.summary).toBe("master");
  });
  it("同じ極で 20 ポイント以上の差", () => {
    const others = [1, 2, 3].map(() => ({ answers: byPole(7, 1) })); // 100%
    const res = computeResult(others, byPole(5, 3)); // 各 +1（4 問）→ 840 → 67%
    expect(res.self!.axes[0]).toMatchObject({
      pole: "E",
      percent: 67,
      gap: "stronger",
    });
  });
  it("自分がど真ん中なら「極がちがう」とは言わない", () => {
    const others = [1, 2, 3].map(() => ({ answers: byPole(7, 1) })); // 100%
    const res = computeResult(others, all(4));
    expect(res.self!.axes.every((a) => a.tie && a.gap === "selfTie")).toBe(
      true,
    );
    expect(res.self!.summary).toBeNull();
    const weak = computeResult(
      [1, 2, 3].map(() => ({ answers: byPole(5, 4) })), // 各軸 +0.5（深掘りして 8 問）→ 420 → 58%
      all(4),
    );
    // 周りが少しでも寄っていれば、一致とは言わない（自分はどちらとも答えていないため）
    expect(weak.self!.axes[0]).toMatchObject({ tie: true, gap: "selfTie" });
    expect(weak.self!.summary).toBeNull();
    // 周りもど真ん中なら一致。ただし、ど真ん中ばかりの答えを「自己理解の達人」とは言わない
    const both = computeResult(
      [1, 2, 3].map(() => ({ answers: all(4) })),
      all(4),
    );
    expect(both.self!.axes.every((a) => a.gap === "match")).toBe(true);
    expect(both.self!.summary).toBeNull();
  });
  it("自己回答は全員の点に入らない", () => {
    const others = [1, 2, 3].map(() => ({ answers: byPole(7, 1) }));
    const a = computeResult(others, null);
    const b = computeResult(others, byPole(1, 7));
    expect(b.axes).toEqual(a.axes);
  });
});

describe("T-10 §7.7 関係ごとの見え方", () => {
  const e = byPole(7, 1);
  const i = byPole(1, 7);
  it("学校 3 人・職場 2 人 → 出ない", () => {
    const res = computeResult(
      [
        ...[1, 2, 3].map(() => ({ answers: e, relation: "school" })),
        ...[1, 2].map(() => ({ answers: i, relation: "work" })),
      ],
      null,
    );
    expect(res.relations).toEqual([]);
  });
  it("学校 3 人・職場 3 人 → 出る", () => {
    const res = computeResult(
      [
        ...[1, 2, 3].map(() => ({ answers: e, relation: "school" })),
        ...[1, 2, 3].map(() => ({ answers: i, relation: "work" })),
      ],
      null,
    );
    expect(res.relations).toEqual([
      { relation: "school", count: 3, type: "ESTJ" },
      { relation: "work", count: 3, type: "INFP" },
    ]);
  });
});

describe("表示名", () => {
  it("8 つの極に名前がある", () => {
    expect(Object.keys(POLE_LABEL)).toHaveLength(8);
  });
});

describe("答えた友達 1 人から見たタイプ（お礼の画面）", () => {
  it("答えの寄った側の 4 文字になる。ちょうど 0 の軸は右の極", async () => {
    const { raterType, NOT_ASKED } = await import("../src/lib/scoring");
    const { QUESTIONS } = await import("../src/data/questions");
    const lean = (code: string) =>
      QUESTIONS.map((q) =>
        q.stage !== "core" ? NOT_ASKED : code.includes(q.pole) ? 6 : 2,
      );
    expect(raterType(lean("ESTJ"))).toBe("ESTJ");
    expect(raterType(lean("INFP"))).toBe("INFP");
    // すべて「どちらとも」なら、どの軸も 0 で右の極
    expect(
      raterType(QUESTIONS.map((q) => (q.stage !== "core" ? NOT_ASKED : 4))),
    ).toBe("INFP");
  });
});
