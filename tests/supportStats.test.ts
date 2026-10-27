// 応援のお願いの記録と集計（仕様書 §4.11）
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import { QUESTIONS } from "../src/data/questions";
import { handleStripeEvent } from "../src/lib/stripe";
import {
  createSurvey,
  deleteSurvey,
  giveGift,
  submitResponse,
} from "../src/lib/surveys";
import {
  cleanupSupport,
  summarizeSupport,
  supporterCount,
} from "../src/lib/supportStats";
import { GET as image } from "../src/app/api/host/image/route";
import { POST as support } from "../src/app/api/host/support/route";
import { POST as premium } from "../src/app/api/host/premium/route";

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
    "delete from payments; delete from support_records; delete from responses; delete from surveys;",
  );
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) await db.close();
});

async function completed() {
  const s = await createSurvey({ nickname: "はなこ", targetCount: 3 });
  if (!s.ok) throw new Error();
  for (const [i, v] of [7, 6, 2].entries())
    await submitResponse(
      s.surveyId,
      { answers: Array(QUESTIONS.length).fill(v) },
      `r${i}`,
    );
  return s;
}

const event = (hostKey: string, e: string) =>
  support(
    new NextRequest("https://takoshin.example/api/host/support", {
      method: "POST",
      headers: { "x-host-key": hostKey, "content-type": "application/json" },
      body: JSON.stringify({ event: e }),
    }),
  );

async function pay(surveyId: string) {
  await handleStripeEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${surveyId}`,
        payment_status: "paid",
        amount_total: 300,
        metadata: { survey_id: surveyId },
      },
    },
  });
}

describe("応援のお願いの集計", () => {
  it("応援するを押したか × 支払ったか の 4 通りと、閉じた・支払いのページだけ開いた、を数える", async () => {
    const paid = await completed(); // 見た → 応援する → 支払った
    await event(paid.hostKey, "seen");
    await giveGift(paid.hostKey);
    await pay(paid.surveyId);

    const unpaid = await completed(); // 見た → 応援する → 支払っていない
    await event(unpaid.hostKey, "seen");
    await giveGift(unpaid.hostKey);
    await db.query(
      `update support_records set checkout_at = now()
        where id = (select support_record_id from surveys where id = $1)`,
      [unpaid.surveyId],
    );

    const closed = await completed(); // 見た → 今回は閉じる
    await event(closed.hostKey, "seen");
    await event(closed.hostKey, "closed");

    const ignored = await completed(); // 見ただけ
    await event(ignored.hostKey, "seen");
    await event(ignored.hostKey, "seen"); // 何度見ても 1 件

    await completed(); // 見ていない診断は数えない

    const s = await summarizeSupport(7);
    expect(s).toMatchObject({
      seen: 4,
      giftPaid: 1,
      giftUnpaid: 1,
      noGiftPaid: 0,
      noGiftUnpaid: 2,
      closed: 1,
      checkoutUnpaid: 1,
    });
  });

  it("診断を消しても、集計の数としては残る", async () => {
    const s = await completed();
    await event(s.hostKey, "seen");
    await giveGift(s.hostKey);
    expect(await deleteSurvey(s.hostKey)).toBe("ok");
    expect((await summarizeSupport(null)).giftUnpaid).toBe(1);
  });

  it("ちがう出来事・結果が出ていない診断・鍵がちがうときは記録しない", async () => {
    const s = await completed();
    expect((await event(s.hostKey, "paid")).status).toBe(400);
    expect((await event("x".repeat(22), "seen")).status).toBe(404);
    const open = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!open.ok) throw new Error();
    expect((await event(open.hostKey, "seen")).status).toBe(409);
    expect((await summarizeSupport(null)).seen).toBe(0);
  });

  it("400 日より前の記録は消す", async () => {
    const s = await completed();
    await event(s.hostKey, "seen");
    await db.query(`update support_records set day = '2020-01-01'`);
    expect(await cleanupSupport()).toBe(1);
    expect((await summarizeSupport(null)).seen).toBe(0);
  });
});

describe("金額を選んで支払いのページを開く", () => {
  it("選べる金額だけを Stripe に送り、ほかの金額は断る。金額ごとの件数と合計を数える", async () => {
    const env = {
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      SUPPORT_PRICE_YEN: "300",
    };
    const prev = { ...process.env };
    Object.assign(process.env, env);
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      // 開き直したときに前の支払いのページを閉じる呼び出しは、数えない
      if (url.endsWith("/expire")) return new Response("{}");
      sent.push(String(init.body));
      return new Response(
        JSON.stringify({
          url: "https://checkout.stripe.com/c/x",
          id: `cs_${sent.length}`,
        }),
      );
    });
    try {
      const s = await completed();
      const open = (amount?: unknown) =>
        premium(
          new NextRequest("https://takoshin.example/api/host/premium", {
            method: "POST",
            headers: {
              "x-host-key": s.hostKey,
              host: "takoshin.example",
              "content-type": "application/json",
            },
            body: amount === undefined ? undefined : JSON.stringify({ amount }),
          }),
        );
      expect((await open(500)).status).toBe(200);
      expect(sent.at(-1)).toContain("unit_amount%5D=500");
      expect((await open()).status).toBe(200); // 金額がなければ、いちばん安い金額
      expect(sent.at(-1)).toContain("unit_amount%5D=300");
      expect((await open(700)).status).toBe(400);
      expect((await open("500")).status).toBe(400);
      expect(sent).toHaveLength(2);

      await db.query(
        `insert into payments (session_id, survey_id, amount) values
           ('cs_a', null, 500), ('cs_b', null, 500), ('cs_c', null, 1000)`,
      );
      const sum = await summarizeSupport(7);
      expect(sum.amounts).toEqual([
        { amount: 500, count: 2 },
        { amount: 1000, count: 1 },
      ]);
      expect(sum.total).toBe(2000);
    } finally {
      vi.unstubAllGlobals();
      for (const k of Object.keys(env)) delete process.env[k];
      Object.assign(process.env, prev);
    }
  });
});

describe("応援してくれた人数とサポーターのシール", () => {
  it("人数は支払いの記録の件数で、20 人に届くまでは出さない", async () => {
    const values = Array.from(
      { length: 19 },
      (_, i) => `('cs_${i}', null, 300)`,
    ).join(",");
    await db.query(
      `insert into payments (session_id, survey_id, amount) values ${values}`,
    );
    expect(await supporterCount()).toBeNull();
    await db.query(
      `insert into payments (session_id, survey_id, amount) values ('cs_x', null, 500)`,
    );
    expect(await supporterCount()).toBe(20);
  });

  it("シールは、支払った診断のスペシャル版だけ。応援するを押しただけでは入れられない", async () => {
    const s = await completed();
    const img = (q: string) =>
      image(
        new NextRequest(
          `https://takoshin.example/api/host/image?size=wide${q}`,
          {
            headers: { "x-host-key": s.hostKey },
          },
        ),
      );
    await giveGift(s.hostKey);
    expect((await img("&special=1&supporter=1")).status).toBe(403);
    await pay(s.surveyId);
    expect((await img("&supporter=1")).status).toBe(403); // スペシャル版でないとき
    expect((await img("&special=1&supporter=1")).status).toBe(200);
  });
});
