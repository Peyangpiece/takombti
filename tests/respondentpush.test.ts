// 答えた人の「結果が出たら知らせてもらう」の API（仕様書 §4.10・§11.10）：回答者の鍵（cookie）で確かめる
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { RESPONSE_LIMIT } from "../src/lib/http";
import { b64url } from "../src/lib/push";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import { createSurvey, submitResponse } from "../src/lib/surveys";
import { QUESTIONS } from "../src/data/questions";
import {
  DELETE as unsubscribe,
  POST as subscribe,
} from "../src/app/api/surveys/[surveyId]/push/route";

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

async function device(i: number) {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/route${i}`,
    keys: {
      p256dh: b64url(
        new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)),
      ),
      auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

function call(
  method: "POST" | "DELETE",
  surveyId: string,
  body: unknown,
  { cookie, ip = "192.0.2.50" }: { cookie?: string; ip?: string } = {},
) {
  const req = new NextRequest(`https://x.test/api/surveys/${surveyId}/push`, {
    method,
    headers: {
      "cf-connecting-ip": ip,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return (method === "POST" ? subscribe : unsubscribe)(req, ctx(surveyId));
}

describe("POST/DELETE /api/surveys/{surveyId}/push", () => {
  it("回答者の鍵がない・答えていない鍵は断り、答えて受け付けられた鍵なら登録できる", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error("create");
    const sub = await device(1);
    const cookieName = `tkr_${s.surveyId}`;

    const none = await call("POST", s.surveyId, { subscription: sub });
    expect(none.status).toBe(403);

    const notAnswered = await call(
      "POST",
      s.surveyId,
      { subscription: sub },
      { cookie: `${cookieName}=key-not-answered` },
    );
    expect(notAnswered.status).toBe(403);

    await submitResponse(s.surveyId, { answers }, "key-answered");
    const ok = await call(
      "POST",
      s.surveyId,
      { subscription: sub },
      { cookie: `${cookieName}=key-answered` },
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ status: "ok" });

    // ほかの診断の鍵では、この診断に登録できない
    const other = await createSurvey({ nickname: "はな", targetCount: 3 });
    if (!other.ok) throw new Error("create");
    const wrong = await call(
      "POST",
      other.surveyId,
      { subscription: sub },
      { cookie: `tkr_${other.surveyId}=key-answered` },
    );
    expect(wrong.status).toBe(403);

    const bad = await call(
      "POST",
      s.surveyId,
      { subscription: { ...sub, endpoint: "https://evil.example/x" } },
      { cookie: `${cookieName}=key-answered` },
    );
    expect(bad.status).toBe(400);

    const del = await call(
      "DELETE",
      s.surveyId,
      { endpoint: sub.endpoint },
      { cookie: `${cookieName}=key-answered` },
    );
    expect(del.status).toBe(200);
    const { rows } = await db.query(
      `select 1 from push_subscriptions where survey_id = $1`,
      [s.surveyId],
    );
    expect(rows).toHaveLength(0);
  });

  it("ホストの印の cookie がある端末・形のちがう ID は断る", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error("create");
    const res = await call(
      "POST",
      s.surveyId,
      { subscription: await device(2) },
      { cookie: `tkh_${s.surveyId}=1` },
    );
    expect(res.status).toBe(403);
    const bad = await call("POST", "a/b", { subscription: await device(2) });
    expect(bad.status).toBe(404);
  });

  it("結果が出たあとは 409", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error("create");
    for (let i = 0; i < 3; i++)
      await submitResponse(s.surveyId, { answers }, `done-${i}`);
    const res = await call(
      "POST",
      s.surveyId,
      { subscription: await device(3) },
      { cookie: `tkr_${s.surveyId}=done-0` },
    );
    expect(res.status).toBe(409);
  });

  it("同じ回線から、診断ごとに 1 時間 RESPONSE_LIMIT 回まで", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error("create");
    const ip = "192.0.2.77";
    for (let i = 0; i < RESPONSE_LIMIT; i++)
      expect(
        (await call("POST", s.surveyId, { subscription: {} }, { ip })).status,
      ).toBe(403);
    expect(
      (await call("POST", s.surveyId, { subscription: {} }, { ip })).status,
    ).toBe(429);
  });
});
