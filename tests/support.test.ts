// 結果の画面の応援のお願い（仕様書 §4.11）
import { describe, expect, it } from "vitest";
import { supportUrl } from "../src/components/SupportCard";

describe("応援の行き先", () => {
  it("https のアドレスだけ使い、ほかは出さない", () => {
    expect(supportUrl("https://ofuse.me/example")).toBe(
      "https://ofuse.me/example",
    );
    expect(supportUrl("http://example.com/")).toBeNull();
    expect(supportUrl("javascript:alert(1)")).toBeNull();
    expect(supportUrl("")).toBeNull();
  });
});
