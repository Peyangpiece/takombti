// 問い合わせと運営者の確認
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  cleanupInquiries,
  createInquiry,
  deleteInquiry,
  isAdmin,
  listInquiries,
  setInquiryHandled,
  surveyIdFrom,
} from "../src/lib/inquiries";
import { createSurvey, deleteSurveyById, getPublic } from "../src/lib/surveys";

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
    "delete from inquiries; delete from responses; delete from surveys;",
  );
});

afterAll(async () => {
  await db.close();
});

describe("問い合わせ", () => {
  it("受け付けて、一覧・対応済み・削除ができる", async () => {
    expect(
      await createInquiry({ kind: "bug", body: "  画面が止まる  " }),
    ).toEqual({ ok: true });
    const [q] = await listInquiries();
    expect(q).toMatchObject({
      kind: "bug",
      body: "画面が止まる",
      replyTo: null,
      handled: false,
    });
    expect(await setInquiryHandled(q.id, true)).toBe(true);
    expect((await listInquiries())[0].handled).toBe(true);
    expect(await deleteInquiry(q.id)).toBe(true);
    expect(await listInquiries()).toEqual([]);
  });

  it("おかしな入力は断る", async () => {
    expect(await createInquiry({ kind: "x", body: "a" })).toEqual({
      ok: false,
      error: "bad_kind",
    });
    expect(await createInquiry({ kind: "bug", body: "   " })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(
      await createInquiry({ kind: "bug", body: "あ".repeat(2001) }),
    ).toEqual({
      ok: false,
      error: "too_long",
    });
  });

  it("管理用リンクの鍵（# より後ろ）は保存しない", async () => {
    await createInquiry({
      kind: "abuse",
      body: "悪口",
      surveyRef: "https://takoshin.example/h#secretHostKey1234567",
    });
    const [q] = await listInquiries();
    expect(q.surveyRef).toBe("https://takoshin.example/h");
    expect(q.surveyRef).not.toContain("secret");
  });

  it("招待リンクから診断の ID を取り出し、運営者が消せる", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error();
    await createInquiry({
      kind: "abuse",
      body: "悪口に使われている",
      surveyRef: `https://takoshin.example/a/${s.surveyId}`,
    });
    const [q] = await listInquiries();
    expect(q.surveyId).toBe(s.surveyId);
    expect(await deleteSurveyById(s.surveyId)).toBe(true);
    expect(await getPublic(s.surveyId)).toBeNull();
  });

  it("180 日で消える", async () => {
    await createInquiry({ kind: "other", body: "a" });
    const day = 24 * 60 * 60 * 1000;
    expect(await cleanupInquiries(new Date(Date.now() + 179 * day))).toBe(0);
    expect(await cleanupInquiries(new Date(Date.now() + 181 * day))).toBe(1);
  });
});

describe("ID の取り出し", () => {
  it("招待リンク・ID だけ・ちがう形", () => {
    expect(surveyIdFrom("https://x.dev/a/AbCdEfGhIjKlMnOpQrStUv")).toBe(
      "AbCdEfGhIjKlMnOpQrStUv",
    );
    expect(surveyIdFrom("AbCdEfGhIjKlMnOpQrStUv")).toBe(
      "AbCdEfGhIjKlMnOpQrStUv",
    );
    expect(surveyIdFrom("たろうの診断")).toBeNull();
    expect(surveyIdFrom(null)).toBeNull();
  });
});

describe("運営者の合言葉", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  it("一致するときだけ通す", () => {
    expect(isAdmin(secret, secret)).toBe(true);
    expect(isAdmin(secret + "x", secret)).toBe(false);
    expect(isAdmin(null, secret)).toBe(false);
  });
  it("合言葉が未設定・短すぎるときはだれも通さない", () => {
    expect(isAdmin("anything", undefined)).toBe(false);
    expect(isAdmin("short", "short")).toBe(false);
  });
});
