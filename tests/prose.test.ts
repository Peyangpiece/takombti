// 長い文を短い段落に分ける（仕様書 §4.11・§7.4）
import { describe, expect, it } from "vitest";
import { paragraphs, sentences } from "../src/lib/prose";
import { TYPE_CODES, getType } from "../src/data/framework";

describe("sentences", () => {
  it("「。」で区切る。「」や（）の中の「。」では切らない", () => {
    expect(sentences("あいう。「えお。かき」と言う。（く。け）こ。")).toEqual([
      "あいう。",
      "「えお。かき」と言う。",
      "（く。け）こ。",
    ]);
  });
  it("「。」で終わらない最後の文も残す", () => {
    expect(sentences("あいう。えお")).toEqual(["あいう。", "えお"]);
  });
});

describe("paragraphs", () => {
  it("2 文ずつの段落にまとめる", () => {
    expect(paragraphs("一。二。三。四。")).toEqual(["一。二。", "三。四。"]);
  });
  it("最後に短い 1 文だけが残るときは、前の段落につなげる", () => {
    expect(paragraphs("一。二。三。")).toEqual(["一。二。三。"]);
  });
  it("文を書きかえない（つなげると元の文に戻る）", () => {
    for (const code of TYPE_CODES) {
      const text = getType(code).friendView;
      const parts = paragraphs(text);
      expect(parts.join("")).toBe(text);
      // どのタイプの文も、2 つ以上の段落に分かれる（長い 1 段落のままにしない）
      expect(parts.length).toBeGreaterThanOrEqual(2);
    }
  });
});
