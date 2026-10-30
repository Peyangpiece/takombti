// 回答の API（仕様書 §5.3・§8.3・§8.4）：鍵（cookie）の渡し方と、同じ回線からの回数の数え方
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { REJECT_LIMIT } from "../src/lib/http";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import { createSurvey } from "../src/lib/surveys";
import { QUESTIONS } from "../src/data/questions";
import { GET as publicView } from "../src/app/api/surveys/[surveyId]/public/route";
import { POST as respond } from "../src/app/api/surveys/[surveyId]/responses/route";

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
afterAll(async () => {
  if (!process.env.DATABASE_URL) await db.close();
});

const answers = Array(QUESTIONS.length).fill(6);
const ctx = (surveyId: string) => ({ params: Promise.resolve({ surveyId }) });

function cookieOf(res: Response, name: string): string | null {
  const all = res.headers.getSetCookie();
  const hit = all.find(
    (c) => c.startsWith(`${name}=`) && !c.includes("Max-Age=0"),
  );
  return hit ? hit.split(";")[0].slice(name.length + 1) : null;
}

describe("回答者の鍵", () => {
  it("招待のページを開いたときに渡す。送った返事が届かなくても、送り直しは 2 人目として数えない", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error("create");
    const ip = { "cf-connecting-ip": "192.0.2.10" };
    const view = await publicView(
      new NextRequest(`https://x.test/api/surveys/${s.surveyId}/public`, {
        headers: ip,
      }),
      ctx(s.surveyId),
    );
    const key = cookieOf(view, `tkr_${s.surveyId}`);
    expect(key).toBeTruthy();
    // 鍵はその診断の API にだけ送られる
    expect(
      view.headers
        .getSetCookie()
        .some((c) => c.includes(`Path=/api/surveys/${s.surveyId}`)),
    ).toBe(true);
    const send = () =>
      respond(
        new NextRequest(`https://x.test/api/surveys/${s.surveyId}/responses`, {
          method: "POST",
          headers: {
            ...ip,
            "content-type": "application/json",
            cookie: `tkr_${s.surveyId}=${key}`,
          },
          body: JSON.stringify({ answers, relation: null }),
        }),
        ctx(s.surveyId),
      );
    expect((await send()).status).toBe(201);
    // 返事が途中で切れて、もう一度送った
    expect((await send()).status).toBe(409);
  });

  it("受け付けなかった送信は数えない（同じ回線の友達が締め出されない）", async () => {
    const s = await createSurvey({ nickname: "はなこ", targetCount: 30 });
    if (!s.ok) throw new Error("create");
    const ip = { "cf-connecting-ip": "192.0.2.20" };
    const post = (body: unknown, cookie?: string) =>
      respond(
        new NextRequest(`https://x.test/api/surveys/${s.surveyId}/responses`, {
          method: "POST",
          headers: {
            ...ip,
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
          },
          body: JSON.stringify(body),
        }),
        ctx(s.surveyId),
      );
    // 形のまちがった送信を 25 回
    for (let i = 0; i < 25; i++)
      expect((await post({ answers: [1], relation: null })).status).toBe(400);
    // それでも、同じ回線の人は答えられる
    expect((await post({ answers, relation: null })).status).toBe(201);
  });

  it("受け付けなかった送信も、別の上限（REJECT_LIMIT）を超えると止める", async () => {
    const s = await createSurvey({ nickname: "はなこ", targetCount: 30 });
    if (!s.ok) throw new Error("create");
    const ip = { "cf-connecting-ip": "192.0.2.21" };
    const post = (body: unknown) =>
      respond(
        new NextRequest(`https://x.test/api/surveys/${s.surveyId}/responses`, {
          method: "POST",
          headers: { ...ip, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        ctx(s.surveyId),
      );
    for (let i = 0; i < REJECT_LIMIT; i++)
      expect((await post({ answers: [1], relation: null })).status).toBe(400);
    expect((await post({ answers: [1], relation: null })).status).toBe(429);
    // 正しい回答も、その回線からはいったん止まる（1 時間後に戻る）
    expect((await post({ answers, relation: null })).status).toBe(429);
  });

  it("大きすぎる本文は、回数を数える前に断る", async () => {
    const s = await createSurvey({ nickname: "はなこ", targetCount: 30 });
    if (!s.ok) throw new Error("create");
    const big = JSON.stringify({ answers, relation: "x".repeat(20_000) });
    const res = await respond(
      new NextRequest(`https://x.test/api/surveys/${s.surveyId}/responses`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "192.0.2.22",
          "content-type": "application/json",
        },
        body: big,
      }),
      ctx(s.surveyId),
    );
    expect(res.status).toBe(400);
  });
});
