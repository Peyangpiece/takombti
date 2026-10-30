// くわしい分析の読み物（仕様書 §4.11）：その人の結果から組み立てる読み解き
import { describe, expect, it } from "vitest";
import { deepReading } from "../src/lib/deepAnalysis";
import { DEEP_TYPES } from "../src/data/deepTypes";
import { TYPE_CODES } from "../src/data/framework";
import type { DetailedAnalysis, QuestionStat } from "../src/lib/premium";
import type { AxisResult } from "../src/lib/scoring";

const q = (
  no: number,
  lean: QuestionStat["lean"] = "agree",
  self: number | null = null,
): QuestionStat => ({
  no,
  axis: "A1",
  summary: `問い${no}`,
  answered: 3,
  agree: lean === "agree" ? 3 : 0,
  neutral: lean === "middle" ? 3 : 0,
  disagree: lean === "disagree" ? 3 : 0,
  lean,
  self,
});

const base: DetailedAnalysis = {
  questions: [q(1)],
  agreed: [1],
  split: [],
  gaps: [],
  johari: null,
  dots: null,
};

const axes: AxisResult[] = [
  {
    axis: "A1",
    pole: "E",
    percent: 80,
    strength: "しっかり",
    agreement: "満場一致",
    tie: false,
  },
  {
    axis: "A2",
    pole: "N",
    percent: 60,
    strength: "やや",
    agreement: "多数派",
    tie: false,
  },
  {
    axis: "A3",
    pole: "F",
    percent: 50,
    strength: "ほぼ半々",
    agreement: "意見が割れた",
    tie: true,
  },
  {
    axis: "A4",
    pole: "P",
    percent: 90,
    strength: "振り切れ",
    agreement: "満場一致",
    tie: false,
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
    const r = deepReading("ENFP", axes, base);
    expect(r.axes).toHaveLength(4);
    expect(r.axes[0].text).toContain("元気がたまっていく");
    expect(r.axes[1].text).toContain("どちらかといえば");
    expect(r.axes[2].text).toContain("両方");
    expect(r.chapters[0].id).toBe("intro");
  });

  it("分かれた問い（サーバーで選んだもの）があるときだけ「分かれた」と言う", () => {
    expect(deepReading("ENFP", axes, base).view).toHaveLength(1);
    const split = { ...base, questions: [q(1), q(3, "middle")], split: [3] };
    expect(deepReading("ENFP", axes, split).view[1]).toContain(
      "セルフ・モニタリング",
    );
  });

  it("そろった問いの向きで文を変える", () => {
    const no = { ...base, questions: [q(1, "disagree")] };
    expect(deepReading("ENFP", axes, no).view[0]).toContain("ちがう");
  });

  it("ジョハリの窓は、サーバーで選んだものをそのまま使う", () => {
    const johari = { open: ["問い1"], blind: [], hidden: ["問い3"] };
    expect(deepReading("INTJ", axes, { ...base, johari }).johari).toEqual(
      johari,
    );
    expect(deepReading("INTJ", axes, base).johari).toBeNull();
  });
});

describe("見え方の散らばりで、軸の文を変える", () => {
  const analysis: DetailedAnalysis = base;

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

describe("真ん中にそろった問い・半々に近い軸（§4.11）", () => {
  it("答えが「どちらとも」にそろった問いは、場面によって変わるとは言わない", () => {
    const mid = { ...base, questions: [q(1, "middle")] };
    const t = deepReading("ENFP", axes, mid).view[0];
    expect(t).toContain("みんな真ん中寄りに見ている");
    expect(t).not.toContain("場面によって");
  });
  it("ど真ん中・ほぼ半々の軸があれば、反対のタイプの文が当てはまることもあると添える", () => {
    // axes の A3 はど真ん中
    const r = deepReading("ENFP", axes, base);
    expect(r.caveat).toContain("「思考 / 感情」の軸は半々に近い");
    expect(r.caveat).toContain("ENTP");
    const clear = axes.map((a) => ({ ...a, tie: false, percent: 80 }));
    expect(deepReading("ENFP", clear, base).caveat).toBeNull();
  });
});

describe("タイプごとの読み物の言い方（§7.1）", () => {
  it("心の中を言い切らない（「あなたの内側では」「周りから見たあなたは〜人です」としない）", () => {
    for (const t of TYPE_CODES) {
      const all = JSON.stringify(DEEP_TYPES[t]);
      expect(all, t).not.toMatch(
        /あなたの内側|周りから見たあなたは|友達から見たあなたは|あなたの原動力|あなたの心の真ん中|あなたの行動の(奥|中心)/,
      );
    }
  });
});
