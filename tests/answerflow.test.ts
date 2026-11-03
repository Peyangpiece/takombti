// 回答の残りの目安時間（仕様書 §4.8）
import { describe, expect, it } from "vitest";
import {
  answeredSummary,
  extraMinutes,
  isTypingTarget,
  missingAnswers,
  progressOf,
  remainingHint,
} from "../src/components/AnswerFlow";
import { QUESTIONS } from "../src/data/questions";
import { NOT_ASKED, UNKNOWN } from "../src/lib/scoring";

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

describe("progressOf（番号と進み具合の帯。§4.8・§4.9）", () => {
  it("基本の問は「n / 16」", () => {
    expect(progressOf(0, 16, 0, null)).toEqual({
      label: "1 / 16",
      value: 0,
      max: 16,
    });
    // 深掘りが決まったあとに基本の問へ戻っても、分母は 16 のまま
    expect(progressOf(5, 32, 16, null).label).toBe("6 / 16");
  });
  it("深掘りの問は「追加 n / 足した数」と数え直し、帯も足した分だけで測る", () => {
    expect(progressOf(16, 32, 16, null)).toEqual({
      label: "追加 1 / 16",
      value: 0,
      max: 16,
    });
    expect(progressOf(19, 24, 19, null)).toEqual({
      label: "追加 4 / 8",
      value: 3,
      max: 8,
    });
  });
  it("「わからない」の問へ戻ったときは、その場面だけで数える", () => {
    expect(progressOf(3, 32, 32, { done: 0, total: 3 })).toEqual({
      label: "1 / 3",
      value: 0,
      max: 3,
    });
    expect(progressOf(7, 32, 32, { done: 2, total: 3 }).label).toBe("3 / 3");
  });
});

describe("extraMinutes（深掘りの前の 1 枚の「約 N 分」）", () => {
  it("1 問 11 秒で数えて分に丸め、1 分より短くても 1 分", () => {
    expect(extraMinutes(16)).toBe(3);
    expect(extraMinutes(8)).toBe(1);
    expect(extraMinutes(4)).toBe(1);
  });
});

describe("answeredSummary（確認の画面。§4.9）", () => {
  it("出した問の数と「わからない」の数を出し、出していない問は数えない", () => {
    const answers: number[] = QUESTIONS.map((q) =>
      q.stage === "core" ? 5 : NOT_ASKED,
    );
    expect(answeredSummary(answers)).toBe("16 問に答えました。");
    answers[0] = UNKNOWN;
    answers[1] = UNKNOWN;
    expect(answeredSummary(answers)).toBe(
      "16 問に答えました（わからない 2 問）。",
    );
  });
});

describe("missingAnswers（判定できない軸に足りない問の数。§3.4）", () => {
  it("軸ごとに 3 問に足りない数を合計する", () => {
    // A1（外向／内向）の基本の 4 問のうち 3 問が「わからない」、ほかの軸は答えてある
    const answers: number[] = QUESTIONS.map((q) =>
      q.stage === "core" ? 6 : NOT_ASKED,
    );
    for (const no of [1, 2, 3]) answers[no - 1] = UNKNOWN;
    for (const q of QUESTIONS.filter(
      (x) => x.axis === "A1" && x.stage === "follow",
    ))
      answers[q.no - 1] = UNKNOWN;
    expect(missingAnswers(answers)).toBe(2);
    answers[0] = 6;
    expect(missingAnswers(answers)).toBe(1);
    answers[1] = 2;
    expect(missingAnswers(answers)).toBe(0);
  });
});
