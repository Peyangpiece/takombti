// 回答の残りの目安時間（仕様書 §4.8）
import { describe, expect, it } from "vitest";
import { isTypingTarget, remainingHint } from "../src/components/AnswerFlow";

describe("remainingHint", () => {
  it("基本の 16 問だけのときは出さない（最初に「約 3 分」と伝えてある）", () => {
    expect(remainingHint(16, 3)).toBeNull();
  });
  it("深掘りが入ったら、残りの問の数から分で出す", () => {
    expect(remainingHint(32, 16)).toBe("あと 3 分ほど");
    expect(remainingHint(24, 18)).toBe("あと 1 分ほど");
  });
  it("残りが少なければ「もうすぐ終わり」、答え終えたら出さない", () => {
    expect(remainingHint(20, 17)).toBe("もうすぐ終わり");
    expect(remainingHint(20, 20)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("要素でないもの（window など）は文字を打つ欄とみなさない", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({} as EventTarget)).toBe(false);
  });
});
