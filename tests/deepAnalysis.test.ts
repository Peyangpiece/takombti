// くわしい分析の読み物（仕様書 §4.11）：その人の結果から組み立てる読み解き
import { describe, expect, it } from "vitest";
import { deepReading, meaningfulSplit } from "../src/lib/deepAnalysis";
import { DEEP_TYPES } from "../src/data/deepTypes";
import { TYPE_CODES } from "../src/data/framework";
import type { DetailedAnalysis, QuestionStat } from "../src/lib/premium";
import type { AxisResult } from "../src/lib/scoring";

const q = (
  no: number,
  average: number,
  spread: number,
  self: number | null = null,
): QuestionStat => ({
  no,
  axis: "A1",
  summary: `問い${no}`,
  answered: 3,
  agree: average >= 5 ? 3 : 0,
  neutral: 0,
  disagree: average <= 3 ? 3 : 0,
  average,
  spread,
  self,
});

const axes: AxisResult[] = [
  {
    axis: "A1",
    pole: "E",
    percent: 80,
    strength: "しっかり",
    agreement: "満場一致",
    tie: false,
    sum: 1,
  },
  {
    axis: "A2",
    pole: "N",
    percent: 60,
    strength: "やや",
    agreement: "多数派",
    tie: false,
    sum: 1,
  },
  {
    axis: "A3",
    pole: "F",
    percent: 50,
    strength: "ほぼ半々",
    agreement: "意見が割れた",
    tie: true,
    sum: 0,
  },
  {
    axis: "A4",
    pole: "P",
    percent: 90,
    strength: "振り切れ",
    agreement: "満場一致",
    tie: false,
    sum: 1,
  },
];

describe("タイプごとの読み物", () => {
  it("16 タイプすべてに、章の文と強み 5 つ・気をつけたいところ 4 つがある", () => {
    for (const t of TYPE_CODES) {
      const d = DEEP_TYPES[t];
      for (const k of [
        "intro",
        "love",
        "friendship",
        "career",
        "workplace",
        "stress",
        "growth",
        "conclusion",
      ] as const)
        expect(d[k].length).toBeGreaterThan(100);
      expect(d.strengths).toHaveLength(5);
      expect(d.weaknesses).toHaveLength(4);
    }
  });
});

describe("その人の結果から読み解く", () => {
  it("軸ごとに、しっかり・やや・ほぼ半々で文を変える", () => {
    const r = deepReading("ENFP", axes, {
      questions: [q(1, 6, 0.2)],
      agreed: [1],
      split: [],
      gaps: [],
      dots: null,
    });
    expect(r.axes).toHaveLength(4);
    expect(r.axes[0].text).toContain("元気がたまっていく");
    expect(r.axes[1].text).toContain("どちらかといえば");
    expect(r.axes[2].text).toContain("両方");
    expect(r.chapters[0].id).toBe("intro");
  });

  it("答えの分かれ方に差がないときは「分かれた」と言わない", () => {
    const flat: DetailedAnalysis = {
      questions: [q(1, 6, 0.9), q(2, 6, 0.9), q(3, 6, 1.2)],
      agreed: [1, 2],
      split: [3, 2],
      gaps: [],
      dots: null,
    };
    expect(meaningfulSplit(flat)).toEqual([]);
    expect(deepReading("ENFP", axes, flat).view).toHaveLength(1);
    const clear = {
      ...flat,
      questions: [q(1, 6, 0.2), q(2, 6, 0.9), q(3, 4, 2.4)],
    };
    expect(meaningfulSplit(clear)).toEqual([3, 2]);
    expect(deepReading("ENFP", axes, clear).view[1]).toContain(
      "セルフ・モニタリング",
    );
  });

  it("ジョハリの窓：開放・盲点・秘密の窓に、問いを分ける。自己回答がなければ出さない", () => {
    const a: DetailedAnalysis = {
      questions: [
        q(1, 6.5, 0.3, 7), // 開放
        q(2, 6.0, 0.5, 3), // 盲点
        q(3, 2.5, 0.5, 6), // 秘密
        q(4, 5.0, 0.5, 5), // 開放（2 番目）
        q(5, 4.0, 0.5, 4), // どれでもない
      ],
      agreed: [1],
      split: [],
      gaps: [],
      dots: null,
    };
    const r = deepReading("INTJ", axes, a);
    expect(r.johari).toEqual({
      open: ["問い1", "問い4"],
      blind: ["問い2"],
      hidden: ["問い3"],
    });
    const none = deepReading("INTJ", axes, {
      ...a,
      questions: a.questions.map((x) => ({ ...x, self: null })),
    });
    expect(none.johari).toBeNull();
  });
});

describe("見え方の散らばりで、軸の文を変える", () => {
  const analysis: DetailedAnalysis = {
    questions: [q(1, 6, 0.2)],
    agreed: [1],
    split: [],
    gaps: [],
    dots: null,
  };

  it("そろった軸・分かれた軸・真ん中寄りの軸で、文を足したり置きかえたりする", () => {
    const r = deepReading("ENFP", axes, analysis, [
      "aligned",
      "divided",
      "middle",
      null,
    ]);
    expect(r.axes[0].text).toContain("友達のあいだでそろっていました");
    expect(r.axes[1].text).toContain("見え方に幅がありました");
    // ほぼ半々の軸は、どっちつかずの文に置きかえる（使い分けの文は出さない）
    expect(r.axes[2].text).toContain("言いきっていませんでした");
    expect(r.axes[2].text).not.toContain("両方");
  });

  it("散らばりがなければ、これまでと同じ文", () => {
    const before = deepReading("ENFP", axes, analysis);
    const none = deepReading("ENFP", axes, analysis, [null, null, null, null]);
    expect(none.axes).toEqual(before.axes);
  });

  it("分かれた軸には、自分ではどちらだと思っているかを添える。人数は書かない", () => {
    const r = deepReading(
      "ENFP",
      axes,
      analysis,
      ["divided", "divided", null, null],
      [
        { axis: "A1", pole: "I", percent: 70, tie: false, gap: "pole" },
        { axis: "A2", pole: "N", percent: 50, tie: true, gap: "selfTie" },
      ],
    );
    expect(r.axes[0].text).toContain("あなた自身は、内向のほうを");
    expect(r.axes[1].text).not.toContain("あなた自身は");
    for (const a of r.axes) expect(a.text).not.toMatch(/\d\s*人/);
    // 2 つ以上の軸で分かれたら、まとめの一文を足す
    expect(
      r.view.some((t) =>
        t.includes("2 つで、友達によって見え方が分かれました"),
      ),
    ).toBe(true);
  });
});
