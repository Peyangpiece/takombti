// 判定の計算と分析の材料（仕様書 §6・§7・§14）
import { describe, expect, it } from "vitest";
import {
  computeResult,
  leftPercent,
  raterAxisScore,
  validateAnswers,
  incompleteAxes,
  UNKNOWN,
} from "../src/lib/scoring";
import { QUESTIONS } from "../src/data/questions";
import { AXES, POLE_LABEL } from "../src/data/framework";

const all = (v: number) => Array(24).fill(v);

// 左の極向きの問に l、右の極向きの問に r を入れた回答
function byPole(l: number, r: number, axes = ["A1", "A2", "A3", "A4"]) {
  return QUESTIONS.map((q) => {
    if (!axes.includes(q.axis)) return 4;
    const left = AXES.find((a) => a.axis === q.axis)!.left;
    return q.pole === left ? l : r;
  });
}

// A1 の 6 問（Q1・Q5・Q9・Q13・Q17・Q21）だけを指定し、ほかは 4
function a1(vals: number[]) {
  const ans = all(4);
  [1, 5, 9, 13, 17, 21].forEach((no, i) => (ans[no - 1] = vals[i]));
  return ans;
}

describe("質問", () => {
  it("各軸 6 問、両方の極に 3 問ずつ", () => {
    for (const { axis, left, right } of AXES) {
      const qs = QUESTIONS.filter((q) => q.axis === axis);
      expect(qs).toHaveLength(6);
      expect(qs.filter((q) => q.pole === left)).toHaveLength(3);
      expect(qs.filter((q) => q.pole === right)).toHaveLength(3);
    }
  });
  it("番号どおりに A1→A4 を繰り返す", () => {
    QUESTIONS.forEach((q, i) => {
      expect(q.no).toBe(i + 1);
      expect(q.axis).toBe(`A${(i % 4) + 1}`);
    });
  });
});

describe("T-1 §6.9 の計算例", () => {
  const r1 = a1([7, 2, 6, 3, 6, 2]);
  const r2 = a1([5, 4, UNKNOWN, 3, 5, 3]);
  const r3 = a1([3, 5, 4, 6, 4, 5]);
  it("1 人の点", () => {
    expect(raterAxisScore(r1, "A1")).toBe(120);
    expect(raterAxisScore(r2, "A1")).toBe(48);
    expect(raterAxisScore(r3, "A1")).toBe(-50);
  });
  it("E・61%・多数派", () => {
    const res = computeResult(
      [r1, r2, r3].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({
      pole: "E",
      percent: 61,
      strength: "やや",
      agreement: "多数派",
      tie: false,
      sum: 118,
    });
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
  // a1([7,4,4,4,4,4]) は Q1 だけ +3 → 3×60÷6 = +30
  const plus30 = a1([7, 4, 4, 4, 4, 4]);
  const minus30 = a1([1, 4, 4, 4, 4, 4]);
  const zero = a1([4, 4, 4, 4, 4, 4]);
  it("手順 1：向きの人数が多いほう", () => {
    // +30・+30・−60（Q1=1 で −3、I 向きの Q5=7 で −3）→ 合計 0、正が 2 人
    const res = computeResult(
      [plus30, plus30, a1([1, 7, 4, 4, 4, 4])].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", tie: true, percent: 50 });
  });
  it("手順 2：自己回答の向き", () => {
    const res = computeResult(
      [plus30, minus30, zero].map((answers) => ({ answers })),
      a1([7, 1, 7, 1, 7, 1]),
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", tie: true });
  });
  it("手順 3：強い答え（±3）だけの合計", () => {
    // +30（+3 が 1 つ）と −30（−1 が 3 つ）→ 強い答えの合計は +3
    const res = computeResult(
      [plus30, a1([3, 5, 3, 4, 4, 4]), zero].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "E", tie: true });
  });
  it("手順 4：それでも決まらなければ右の極", () => {
    const res = computeResult(
      [plus30, plus30, minus30, minus30, zero].map((answers) => ({ answers })),
      null,
    );
    expect(res.axes[0]).toMatchObject({ pole: "I", tie: true });
  });
});

describe("§6.5 一致の度合い", () => {
  const e = a1([7, 1, 7, 1, 7, 1]);
  const i = a1([1, 7, 1, 7, 1, 7]);
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
    const weakI = a1([4, 5, 4, 4, 4, 4]); // -10
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
      for (let x = -180 * n; x <= 180 * n; x += 7) {
        expect(leftPercent(x, n) + leftPercent(-x, n)).toBe(100);
      }
    }
  });
  it("範囲は 0〜100", () => {
    expect(leftPercent(180 * 3, 3)).toBe(100);
    expect(leftPercent(-180 * 3, 3)).toBe(0);
  });
});

describe("T-5 回答の確かめ", () => {
  it("1 つの軸で「わからない」が 4 問 → 送れない", () => {
    const ans = all(5);
    [1, 5, 9, 13].forEach((no) => (ans[no - 1] = UNKNOWN));
    expect(validateAnswers(ans, { allowUnknown: true })).not.toBeNull();
    expect(incompleteAxes(ans)).toEqual(["A1"]);
  });
  it("3 問なら送れる", () => {
    const ans = all(5);
    [1, 5, 9].forEach((no) => (ans[no - 1] = UNKNOWN));
    expect(validateAnswers(ans, { allowUnknown: true })).toBeNull();
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
  it("D3 ど真ん中", () => {
    const res = computeResult(
      [1, 2, 3].map(() => ({ answers: all(4) })),
      null,
    );
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
    const base = all(4);
    base[0] = 7; // Q1 全員そう思う
    base[1] = 1; // Q2 全員ちがう
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
      [{ answers: yes }, { answers: all(4) }, { answers: all(4) }],
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
    const res = computeResult(others, byPole(5, 3)); // 各 +1 → 60 → 67%
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
      [1, 2, 3].map(() => ({ answers: byPole(5, 4) })), // 各軸 +0.5 → 30 → 58%
      all(4),
    );
    expect(weak.self!.axes[0]).toMatchObject({ tie: true, gap: "match" });
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
