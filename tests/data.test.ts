// 16 タイプの本文と相性（仕様書 §7.4・§12・§14 T-12・T-13）
import { describe, expect, it } from "vitest";
import { TYPE_CODES, getType, groupOf, matchesOf } from "../src/data/framework";
import { QUESTIONS, questionText, sceneOf } from "../src/data/questions";
import { charLength, containsNgWord } from "../src/lib/text";

describe("T-13 全 16 タイプの部品と文字数", () => {
  for (const code of TYPE_CODES) {
    it(code, () => {
      const t = getType(code);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.catch.length).toBeGreaterThan(0);
      expect(t.tags).toHaveLength(3);
      expect(charLength(t.friendView)).toBeGreaterThanOrEqual(230);
      expect(charLength(t.friendView)).toBeLessThanOrEqual(350);
      expect(t.strengths).toHaveLength(3);
      for (const s of t.strengths) {
        const len = charLength(s.title) + charLength(s.text);
        expect(len).toBeGreaterThanOrEqual(25);
        expect(len).toBeLessThanOrEqual(60);
      }
      expect(t.cautions).toHaveLength(2);
      for (const c of t.cautions) {
        expect(charLength(c)).toBeGreaterThanOrEqual(40);
        expect(charLength(c)).toBeLessThanOrEqual(80);
      }
      expect(t.aruaru).toHaveLength(3);
      for (const a of t.aruaru) {
        expect(charLength(a)).toBeGreaterThanOrEqual(5);
        expect(charLength(a)).toBeLessThanOrEqual(30);
      }
      // §7.9：命令する言い方を使わない
      const all = [
        t.friendView,
        ...t.cautions,
        ...t.strengths.map((s) => s.text),
      ].join("");
      expect(all).not.toMatch(/すべき|しなさい/);
    });
  }
  it("タイプ名はすべてちがう", () => {
    const names = TYPE_CODES.map((c) => getType(c).name);
    expect(new Set(names).size).toBe(16);
  });
});

describe("T-12 相性", () => {
  it("決まりどおりで、相手から見ても同じ", () => {
    for (const code of TYPE_CODES) {
      const { easy, spark } = matchesOf(code);
      expect(easy[1]).toBe(code[1]);
      expect(easy[2]).toBe(code[2]);
      expect(easy[0]).not.toBe(code[0]);
      expect(easy[3]).not.toBe(code[3]);
      expect(spark[1]).toBe(code[1]);
      expect(spark[0]).not.toBe(code[0]);
      expect(spark[2]).not.toBe(code[2]);
      expect(spark[3]).not.toBe(code[3]);
      expect(matchesOf(easy).easy).toBe(code);
      expect(matchesOf(spark).spark).toBe(code);
    }
  });
  it("仕様書 §12 の表と同じ", () => {
    expect(matchesOf("INTJ")).toEqual({ easy: "ENTP", spark: "ENFP" });
    expect(matchesOf("ESFP")).toEqual({ easy: "ISFJ", spark: "ISTJ" });
  });
});

describe("界隈", () => {
  it("NT・NF・SJ・SP で分かれる", () => {
    expect(groupOf("INTJ")).toBe("G1");
    expect(groupOf("ENFP")).toBe("G2");
    expect(groupOf("ISTJ")).toBe("G3");
    expect(groupOf("ESFP")).toBe("G4");
  });
});

describe("質問文", () => {
  it("回答者向けは {name} で始まり、自己回答版は「わたし」で始まる", () => {
    for (const q of QUESTIONS) {
      const texts = [q.text, ...Object.values(q.scenes ?? {})];
      for (const t of texts) {
        expect(t.startsWith("{name}")).toBe(true);
        expect(t).not.toMatch(/ない(だ)?$/);
      }
      expect(q.selfText.startsWith("わたし")).toBe(true);
    }
  });
  it("関係から場面を選び、場面の言い方がなければふだんの文を使う", () => {
    expect(sceneOf("school")).toBe("friend");
    expect(sceneOf("work")).toBe("work");
    expect(sceneOf(null)).toBe("general");
    expect(sceneOf("other")).toBe("general");
    const q19 = QUESTIONS[18];
    expect(questionText(q19, "work")).toContain("先輩や上司");
    expect(questionText(q19, "general")).toBe(q19.text);
    const q30 = QUESTIONS[29];
    expect(questionText(q30, "work")).toBe(q30.text);
  });
});

describe("禁止語", () => {
  it("含まれていたら止める・短い語は名前そのものだけ止める", () => {
    expect(containsNgWord("シネ")).toBe(true);
    expect(containsNgWord("ばかさん")).toBe(true);
    expect(containsNgWord("ＢＡＫＡ")).toBe(false);
    expect(containsNgWord("かすみ")).toBe(false);
    expect(containsNgWord("ごみやま")).toBe(false);
    expect(containsNgWord("たろう")).toBe(false);
    expect(containsNgWord("キエロ")).toBe(true);
    expect(containsNgWord("はげちゃん")).toBe(true);
    // 名前の一部になりうる短い語は、含まれていても止めない
    expect(containsNgWord("はげやま")).toBe(false);
    expect(containsNgWord("ちびまる")).toBe(false);
    expect(containsNgWord("おしの")).toBe(false);
  });
});

describe("マスコット", () => {
  it("16 タイプと土台の絵がそろい、タイプごとにちがう", async () => {
    const { MASCOTS } = await import("../src/data/mascots");
    expect(Object.keys(MASCOTS).sort()).toEqual([...TYPE_CODES, "BASE"].sort());
    expect(new Set(Object.values(MASCOTS)).size).toBe(17);
    for (const svg of Object.values(MASCOTS)) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/<script|on\w+=/i);
    }
  });
  it("大きさを差し替えられ、知らない記号は土台になる", async () => {
    const { octopusSvg } = await import("../src/components/Octopus");
    expect(octopusSvg("ENFP", 64)).toContain('width="64" height="64"');
    const { MASCOTS } = await import("../src/data/mascots");
    expect(octopusSvg("XXXX", 240)).toBe(MASCOTS.BASE);
  });
});
