// タコ占い（仕様書 §4.11）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import { QUESTIONS } from "../src/data/questions";
import {
  DAILY_MESSAGES,
  LUCKY_COLORS,
  LUCKY_DRINKS,
  TYPE_FORTUNES,
} from "../src/data/fortunes";
import { TYPE_CODES } from "../src/data/framework";
import {
  fortuneByCode,
  fortuneFor,
  newFortuneCode,
  normalizeFortuneCode,
} from "../src/lib/fortune";
import { handleStripeEvent } from "../src/lib/stripe";
import { createSurvey, getHost, submitResponse } from "../src/lib/surveys";
import { POST as fortuneApi } from "../src/app/api/fortune/route";

let db: Db;

beforeAll(async () => {
  if (process.env.DATABASE_URL) {
    const { getDb } = await import("../src/lib/db");
    db = await getDb();
  } else {
    db = await createPgliteDb();
    await migrate(db);
    setDbForTest(db);
  }
});

beforeEach(async () => {
  await db.exec(
    "delete from payments; delete from responses; delete from surveys;",
  );
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) await db.close();
});

describe("占いの文", () => {
  it("16 タイプすべてに、一言・あるある・アドバイスがある", () => {
    for (const t of TYPE_CODES) {
      const f = TYPE_FORTUNES[t];
      expect(f.core.length).toBeGreaterThanOrEqual(8);
      expect(f.aru.length).toBeGreaterThanOrEqual(20);
      expect(f.advice.length).toBeGreaterThanOrEqual(20);
    }
  });
  it("文は合わせて 1000 通りあり、同じ文がくり返されない", () => {
    const texts = [
      ...TYPE_CODES.flatMap((t) => {
        const f = TYPE_FORTUNES[t];
        return [...f.core, ...f.aru, ...f.advice];
      }),
      ...DAILY_MESSAGES,
    ];
    expect(texts.length).toBe(1000);
    expect(new Set(texts).size).toBe(texts.length);
    expect(new Set(LUCKY_DRINKS).size).toBe(LUCKY_DRINKS.length);
    expect(new Set(LUCKY_COLORS).size).toBe(LUCKY_COLORS.length);
  });
});

describe("合言葉", () => {
  it("TAKO-XXXX-XXXX の形で、読みまちがえやすい文字を使わない", () => {
    for (let i = 0; i < 200; i++)
      expect(newFortuneCode()).toMatch(
        /^TAKO-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
      );
  });
  it("小文字・空白・ハイフン・O と 0 のまちがいを許してそろえる", () => {
    expect(normalizeFortuneCode("tako 7kq2 m9xa")).toBe("TAKO-7KQ2-M9XA");
    expect(normalizeFortuneCode("7KQ2M9XO")).toBe("TAKO-7KQ2-M9X0");
    expect(normalizeFortuneCode("TAKO-7KQ2")).toBeNull();
    expect(normalizeFortuneCode(null)).toBeNull();
  });
});

describe("占いの決まり方", () => {
  const day1 = new Date("2026-10-27T03:00:00Z");
  const day2 = new Date("2026-10-28T03:00:00Z");
  it("同じ人・同じ日なら同じ。人ごとの部分は日がかわってもそのまま", () => {
    const a = fortuneFor("ISTJ", "survey-a-0000000000", day1);
    expect(fortuneFor("ISTJ", "survey-a-0000000000", day1)).toEqual(a);
    const b = fortuneFor("ISTJ", "survey-a-0000000000", day2);
    expect([b.aru, b.advice, b.core]).toEqual([a.aru, a.advice, a.core]);
    expect(b.date).not.toBe(a.date);
  });
  it("日や人がかわると、今日の部分がかわる（たくさん試すと、ちがう結果が出る）", () => {
    const drinks = new Set<string>();
    const arus = new Set<string>();
    for (let i = 0; i < 30; i++) {
      drinks.add(
        fortuneFor(
          "ESFP",
          "same-person-000000",
          new Date(day1.getTime() + i * 864e5),
        ).drink,
      );
      arus.add(fortuneFor("ESFP", `person-${i}-000000000`, day1).aru);
    }
    expect(drinks.size).toBeGreaterThan(5);
    expect(arus.size).toBeGreaterThan(1);
    const f = fortuneFor("ESFP", "x".repeat(22), day1);
    for (const v of Object.values(f.today)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe("合言葉で占う", () => {
  async function paidSurvey() {
    const s = await createSurvey({ nickname: "はなこ", targetCount: 3 });
    if (!s.ok) throw new Error();
    for (const [i, v] of [7, 6, 5].entries())
      await submitResponse(
        s.surveyId,
        { answers: Array(QUESTIONS.length).fill(v) },
        `r${i}`,
      );
    await handleStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${s.surveyId}`,
          payment_status: "paid",
          amount_total: 300,
          metadata: { survey_id: s.surveyId },
        },
      },
    });
    return s;
  }

  it("支払いが済むと合言葉ができ、ホストにだけ見え、その合言葉で占える", async () => {
    const s = await paidSurvey();
    const host = (await getHost(s.hostKey))!;
    expect(host.fortuneCode).toMatch(/^TAKO-/);
    const f = await fortuneByCode(host.fortuneCode!.toLowerCase());
    expect(f?.type).toBe(host.result!.type);
    expect(JSON.stringify(f)).not.toContain("はなこ");
    expect(await fortuneByCode("TAKO-0000-0000")).toBeNull();
  });

  it("同じ支払いの知らせがもう一度来ても、合言葉はかわらない", async () => {
    const s = await paidSurvey();
    const first = (await getHost(s.hostKey))!.fortuneCode;
    await handleStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_again",
          payment_status: "paid",
          amount_total: 300,
          metadata: { survey_id: s.surveyId },
        },
      },
    });
    expect((await getHost(s.hostKey))!.fortuneCode).toBe(first);
  });

  it("合言葉のまちがいが続く回線は止める（止めている間は正しくても通さない）", async () => {
    const s = await paidSurvey();
    const code = (await getHost(s.hostKey))!.fortuneCode!;
    const call = (c: string) =>
      fortuneApi(
        new NextRequest("https://takoshin.example/api/fortune", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.50",
          },
          body: JSON.stringify({ code: c }),
        }),
      );
    expect((await call(code)).status).toBe(200);
    for (let i = 0; i < 10; i++)
      expect((await call("TAKO-0000-0000")).status).toBe(404);
    expect((await call(code)).status).toBe(429);
  });
});
