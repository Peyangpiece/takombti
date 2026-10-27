// 特典つきの応援（仕様書 §4.11）：くわしい分析・Stripe の知らせの確かめ・特典を開く
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import { QUESTIONS } from "../src/data/questions";
import { analyze, MIN_PER_QUESTION } from "../src/lib/premium";
import {
  createCheckout,
  handleStripeEvent,
  premiumOffer,
  supportTiers,
  verifyStripeSignature,
} from "../src/lib/stripe";
import {
  createSurvey,
  getHost,
  giveGift,
  submitResponse,
} from "../src/lib/surveys";
import { GET as image } from "../src/app/api/host/image/route";
import { NextRequest } from "next/server";
import { POST as webhook } from "../src/app/api/stripe/webhook/route";

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

const answers = (v: number) => Array(QUESTIONS.length).fill(v);

describe("くわしい分析", () => {
  it("3 人以上が答えた問いだけ集計し、そう思う・どちらとも・ちがうを数える", () => {
    const a = analyze([answers(7), answers(4), answers(1)], null);
    expect(a.questions).toHaveLength(QUESTIONS.length);
    const q = a.questions[0];
    expect([q.answered, q.agree, q.neutral, q.disagree]).toEqual([3, 1, 1, 1]);
    expect(q.average).toBe(4);
    // 2 人しか答えていない問いは出さない
    const two = analyze([answers(7), answers(6), answers(0)], null);
    expect(two.questions).toHaveLength(0);
    expect(MIN_PER_QUESTION).toBe(3);
  });

  it("意見がそろった問い・分かれた問い・自己回答とのちがいを選ぶ", () => {
    const r1 = answers(5);
    const r2 = answers(5);
    const r3 = answers(5);
    // 問 1 だけ意見が割れる
    r1[0] = 1;
    r2[0] = 7;
    r3[0] = 4;
    const self = answers(5);
    self[1] = 1; // 問 2 で自分だけ大きくちがう
    const a = analyze([r1, r2, r3], self);
    expect(a.split[0]).toBe(1);
    expect(a.agreed).not.toContain(1);
    expect(a.gaps).toEqual([2]);
  });
});

describe("Stripe の知らせの署名", () => {
  const secret = "whsec_test";
  const sign = (payload: string, t: number) =>
    `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
  const now = 1_800_000_000_000;
  const t = now / 1000;

  it("正しい署名だけ通す", () => {
    const body = '{"type":"x"}';
    expect(verifyStripeSignature(body, sign(body, t), secret, now)).toBe(true);
    expect(verifyStripeSignature(body + " ", sign(body, t), secret, now)).toBe(
      false,
    );
    expect(verifyStripeSignature(body, sign(body, t), "other", now)).toBe(
      false,
    );
    expect(verifyStripeSignature(body, null, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, t), undefined, now)).toBe(
      false,
    );
  });

  it("5 分より古い知らせは通さない（同じ知らせの送り直しを防ぐ）", () => {
    const body = "{}";
    expect(verifyStripeSignature(body, sign(body, t - 301), secret, now)).toBe(
      false,
    );
  });
});

describe("出せるかどうか", () => {
  const seller = {
    name: "たこ 太郎",
    manager: "たこ 太郎",
    address: "",
    phone: "",
    email: "a@example.com",
    discloseOnRequest: true,
  };
  const env = {
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    SUPPORT_PRICE_YEN: "300",
  };
  it("鍵・値段・販売者の表示がそろったときだけ出す", () => {
    expect(premiumOffer(env, seller)).toEqual({
      price: 300,
      tiers: [300, 500, 1000],
      recommended: 500,
    });
    expect(premiumOffer({ ...env, STRIPE_SECRET_KEY: "" }, seller)).toBeNull();
    expect(
      premiumOffer({ ...env, SUPPORT_PRICE_YEN: "10" }, seller),
    ).toBeNull();
    expect(premiumOffer(env, { ...seller, name: "" })).toBeNull();
    expect(
      premiumOffer(env, { ...seller, discloseOnRequest: false }),
    ).toBeNull();
  });
});

describe("選べる金額", () => {
  it("いちばん安い金額と 500 円・1,000 円の 3 つ。真ん中をおすすめにする", () => {
    expect(supportTiers(300, undefined)).toEqual([300, 500, 1000]);
    expect(supportTiers(500, undefined)).toEqual([500, 1000]);
    expect(supportTiers(300, "300, 800,2000")).toEqual([300, 800, 2000]);
    // 安すぎる・形がちがう金額は使わず、いちばん安い金額は必ず入れる。多くても 3 つ
    expect(supportTiers(300, "100,abc,500,700,900")).toEqual([300, 500, 700]);
  });
});

describe("支払いのページ", () => {
  it("診断の ID だけを渡し、戻り先に管理用の鍵を入れない", async () => {
    let sent = "";
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      return new Response(
        JSON.stringify({ url: "https://checkout.stripe.com/c/x" }),
      );
    }) as unknown as typeof fetch;
    const url = await createCheckout(
      "SURVEYID1234567890",
      "https://takoshin.example",
      300,
      "sk_test",
      fakeFetch,
    );
    expect(url).toBe("https://checkout.stripe.com/c/x");
    const p = new URLSearchParams(sent);
    expect(p.get("client_reference_id")).toBe("SURVEYID1234567890");
    expect(p.get("line_items[0][price_data][unit_amount]")).toBe("300");
    expect(p.get("success_url")).toBe("https://takoshin.example/h/thanks");
    expect(sent).not.toContain("#");
  });
});

describe("特典を開く", () => {
  async function completed() {
    const s = await createSurvey({ nickname: "はなこ", targetCount: 3 });
    if (!s.ok) throw new Error();
    for (const [i, v] of [7, 4, 2].entries())
      await submitResponse(s.surveyId, { answers: answers(v) }, `r${i}`);
    return s;
  }
  const paid = (surveyId: string, id = "cs_1") => ({
    type: "checkout.session.completed",
    data: {
      object: {
        id,
        payment_status: "paid",
        amount_total: 300,
        client_reference_id: surveyId,
        metadata: { survey_id: surveyId },
      },
    },
  });

  it("「応援する」を押すと、スペシャルな画像だけが先に開く（くわしい分析は開かない）", async () => {
    const s = await completed();
    const before = (await getHost(s.hostKey))!;
    expect([before.gifted, before.special, before.premium]).toEqual([
      false,
      false,
      false,
    ]);
    const img = (special: boolean) =>
      image(
        new NextRequest(
          `https://takoshin.example/api/host/image?size=wide${special ? "&special=1" : ""}`,
          { headers: { "x-host-key": s.hostKey } },
        ),
      );
    expect((await img(true)).status).toBe(403);
    expect(await giveGift(s.hostKey)).toBe("ok");
    expect(await giveGift(s.hostKey)).toBe("ok");
    const after = (await getHost(s.hostKey))!;
    expect([after.gifted, after.special, after.premium]).toEqual([
      true,
      true,
      false,
    ]);
    expect(after.analysis).toBeNull();
    expect(await giveGift("x".repeat(22))).toBe("not_found");
  });

  it("結果が出ていない診断には贈れない", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error();
    expect(await giveGift(s.hostKey)).toBe("not_open");
  });

  it("支払いの知らせで特典が開き、くわしい分析が返る。同じ知らせは 1 回だけ数える", async () => {
    const s = await completed();
    expect((await getHost(s.hostKey))!.premium).toBe(false);
    expect((await getHost(s.hostKey))!.analysis).toBeNull();
    expect(await handleStripeEvent(paid(s.surveyId))).toBe("opened");
    expect(await handleStripeEvent(paid(s.surveyId))).toBe("opened");
    const host = (await getHost(s.hostKey))!;
    expect(host.premium).toBe(true);
    expect(host.analysis!.questions.length).toBeGreaterThan(0);
    const { rows } = await db.query(`select count(*)::int as n from payments`);
    expect(rows[0]).toEqual({ n: 1 });
  });

  it("支払いが済んでいない知らせ・ほかの種類の知らせは無視する", async () => {
    const s = await completed();
    const unpaid = paid(s.surveyId, "cs_2");
    unpaid.data.object.payment_status = "unpaid";
    expect(await handleStripeEvent(unpaid)).toBe("ignored");
    expect(await handleStripeEvent({ type: "charge.refunded" })).toBe(
      "ignored",
    );
    expect((await getHost(s.hostKey))!.premium).toBe(false);
  });

  it("消えた診断への支払いは、記録だけ残す", async () => {
    expect(await handleStripeEvent(paid("GONE1234567890ABCD", "cs_3"))).toBe(
      "ignored",
    );
    const { rows } = await db.query(
      `select survey_id from payments where session_id = 'cs_3'`,
    );
    expect(rows[0]).toEqual({ survey_id: null });
  });
});

describe("Stripe の知らせの受け口（/api/stripe/webhook）", () => {
  it("署名がないものは 400、正しいものは受け付ける", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_route";
    try {
      const body = JSON.stringify({ type: "ping" });
      const t = Math.floor(Date.now() / 1000);
      const sig = `t=${t},v1=${createHmac("sha256", "whsec_route").update(`${t}.${body}`).digest("hex")}`;
      const req = (headers: Record<string, string>) =>
        new NextRequest("https://takoshin.example/api/stripe/webhook", {
          method: "POST",
          headers,
          body,
        });
      expect((await webhook(req({}))).status).toBe(400);
      const ok = await webhook(req({ "stripe-signature": sig }));
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ ok: true, result: "ignored" });
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = prev;
    }
  });
});
