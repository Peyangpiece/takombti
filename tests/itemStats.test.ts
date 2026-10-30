// 問ごとの質（仕様書 §11.12）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  MIN_ITEM_RESPONSES,
  cronbachAlpha,
  summarizeAnswers,
  summarizeItems,
} from "../src/lib/itemStats";
import { createSurvey, submitResponse } from "../src/lib/surveys";
import { QUESTIONS } from "../src/data/questions";
import { AXES } from "../src/data/framework";

describe("クロンバックの α", () => {
  it("手で計算できる例と同じ", () => {
    // 3 問・4 人。問の分散は 1.67・1.67・1.67、合計の分散は 15 → α = 1.5 × (1 − 5/15) = 1
    expect(
      cronbachAlpha([
        [1, 1, 1],
        [2, 2, 2],
        [3, 3, 3],
        [4, 4, 4],
      ]),
    ).toBeCloseTo(1);
    // 問どうしが無関係なら 0 に近い・マイナスにもなる
    expect(
      cronbachAlpha([
        [1, 4, 2],
        [4, 1, 3],
        [2, 3, 1],
        [3, 2, 4],
      ])!,
    ).toBeLessThan(0.3);
  });
});

// 左の極の傾向 t の人を、左の極の問は 4+t、右の極の問は 4−t と答える
function answersFor(t: number[]): number[] {
  return QUESTIONS.map((q) => {
    const ai = AXES.findIndex((a) => a.axis === q.axis);
    if (q.stage !== "core") return -1;
    const v = q.pole === AXES[ai].left ? 4 + t[ai] : 4 - t[ai];
    return Math.min(7, Math.max(1, v));
  });
}

describe("問ごとの集計", () => {
  it("向きをそろえて数える。少ないうちは出さない", () => {
    const many = Array.from({ length: MIN_ITEM_RESPONSES }, (_, i) =>
      answersFor([(i % 7) - 3, (i % 5) - 2, (i % 3) - 1, (i % 7) - 3]),
    );
    const s = summarizeAnswers(many);
    expect(s[0].n).toBe(MIN_ITEM_RESPONSES);
    expect(s[0].alpha).toBeCloseTo(1);
    const core = s[0].items.filter((it) => it.stage === "core");
    expect(core).toHaveLength(4);
    expect(core.every((it) => (it.itemRest ?? 0) > 0.99)).toBe(true);
    const few = summarizeAnswers(many.slice(0, MIN_ITEM_RESPONSES - 1));
    expect(few[0].alpha).toBeNull();
  });
  it("「わからない」の割合", () => {
    const rows = Array.from({ length: MIN_ITEM_RESPONSES }, (_, i) => {
      const a = answersFor([1, 1, 1, 1]);
      if (i < 6) a[0] = 0; // Q1 を 6 人が「わからない」
      return a;
    });
    expect(
      summarizeAnswers(rows)[0].items.find((it) => it.no === 1)!.unknownRate,
    ).toBe(0.2);
  });
});

describe("深掘りの問も数える（出した人だけで）", () => {
  it("向きをそろえた平均で、一方に寄った深掘りの問が見つかる", () => {
    // A1 が半々の人（基本の 4 問すべて 4）が、深掘りの Q5（E）にはみんな 7、ほかの深掘りは 4
    const rows = Array.from({ length: MIN_ITEM_RESPONSES }, (_, i) => {
      const a = answersFor([0, 2, 2, 2]);
      [4, 5, 6, 7].forEach((j) => (a[j] = 4));
      a[4] = 7;
      // 相関が計算できるよう、基本の Q1 だけ少しずらす
      a[0] = i % 2 ? 5 : 3;
      return a;
    });
    const a1 = summarizeAnswers(rows)[0];
    expect(a1.items.map((it) => it.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const q5 = a1.items.find((it) => it.no === 5)!;
    expect(q5).toMatchObject({
      stage: "follow",
      answered: MIN_ITEM_RESPONSES,
      mean: 7,
    });
    // Q6（I）の 4 は、左の極（E）の向きにそろえても 4
    expect(a1.items.find((it) => it.no === 6)!.mean).toBe(4);
    // 深掘りを出していない軸の深掘りの問は、答えた数が 0 で値は出さない
    const a2 = summarizeAnswers(rows)[1];
    expect(a2.items.find((it) => it.no === 13)).toMatchObject({
      answered: 0,
      mean: null,
      itemRest: null,
      unknownRate: null,
    });
  });
});

describe("データベースから", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createPgliteDb();
    await migrate(db);
    setDbForTest(db);
  });
  afterAll(async () => {
    await db.close();
  });
  it("テストの診断の回答は入れない", async () => {
    const real = await createSurvey({ nickname: "たろう", targetCount: 3 });
    const test = await createSurvey(
      { nickname: "はな", targetCount: 3 },
      new Date(),
      {
        origin: "none",
        campaign: null,
        entry: "none",
        test: true,
      },
    );
    if (!real.ok || !test.ok) throw new Error();
    const all6 = Array(QUESTIONS.length).fill(6);
    for (const k of ["a", "b", "c"])
      await submitResponse(real.surveyId, { answers: all6 }, k);
    for (const k of ["d", "e", "f"])
      await submitResponse(test.surveyId, { answers: all6 }, k);
    // 受付中の診断の回答も入れない（テストの印の付け外しの前後の差から、1 件だけの回答が読めるため）
    const open = await createSurvey({ nickname: "じろう", targetCount: 3 });
    if (!open.ok) throw new Error();
    await submitResponse(open.surveyId, { answers: all6 }, "g");
    expect((await summarizeItems()).responses).toBe(3);
  });
});
