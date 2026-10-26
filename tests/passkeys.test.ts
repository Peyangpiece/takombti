// 運営者のパスキー（仕様書 §8.6）。指紋・顔認証そのものはブラウザの自動テストで確かめる
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  SESSION_COOKIE,
  cleanName,
  cleanupAdminAuth,
  createSession,
  endSession,
  isSession,
  loginOptions,
  loginWithPasskey,
  registerPasskey,
  registrationOptions,
  relyingPartyOf,
} from "../src/lib/passkeys";
import { requireAdmin } from "../src/lib/admin";

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
    "delete from admin_passkeys; delete from admin_challenges; delete from admin_sessions;",
  );
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) await db.close();
});

const rp = relyingPartyOf("takoshin.example")!;

describe("ドメインとアドレスの始まり", () => {
  it("Host から決める。手元だけ http", () => {
    expect(relyingPartyOf("takoshin.example")).toEqual({
      rpID: "takoshin.example",
      origin: "https://takoshin.example",
    });
    expect(relyingPartyOf("localhost:3000")).toEqual({
      rpID: "localhost",
      origin: "http://localhost:3000",
    });
    expect(relyingPartyOf("evil.example/x")).toBeNull();
    expect(relyingPartyOf(null)).toBeNull();
  });
});

describe("パスキーの名前", () => {
  it("制御文字を除き、40 文字までにする。空なら「パスキー」", () => {
    expect(cleanName("iPhone\u0000")).toBe("iPhone");
    expect(cleanName("a".repeat(50))).toHaveLength(40);
    expect(cleanName("")).toBe("パスキー");
  });
});

describe("登録・確かめの値", () => {
  it("登録の値は、本人の確認（指紋・顔など）と端末に入るパスキーを求める", async () => {
    const o = await registrationOptions(rp);
    expect(o.rp.id).toBe("takoshin.example");
    expect(o.authenticatorSelection?.userVerification).toBe("required");
    expect(o.authenticatorSelection?.residentKey).toBe("required");
    const login = await loginOptions(rp);
    expect(login.userVerification).toBe("required");
    expect(login.allowCredentials ?? []).toHaveLength(0);
  });

  it("でたらめな応答では登録も入ることもできない", async () => {
    await registrationOptions(rp);
    expect(await registerPasskey(rp, { id: "x", response: {} }, "x")).toBe(
      false,
    );
    expect(
      await loginWithPasskey(rp, { id: "unknown", response: {} }),
    ).toBeNull();
    expect(await loginWithPasskey(rp, null)).toBeNull();
  });

  it("切れた乱数と記録は定時処理で消す", async () => {
    await db.query(
      `insert into admin_challenges (challenge, kind, expires_at) values ('old', 'login', now() - interval '1 minute')`,
    );
    await db.query(
      `insert into admin_sessions (token_hash, expires_at) values ('h', now() - interval '1 minute')`,
    );
    await loginOptions(rp);
    expect(await cleanupAdminAuth()).toBe(2);
  });
});

describe("入ったあとの記録（cookie）", () => {
  it("作った鍵は使え、出ると使えなくなる", async () => {
    const token = await createSession();
    expect(await isSession(token)).toBe(true);
    expect(await isSession("x".repeat(43))).toBe(false);
    expect(await isSession(undefined)).toBe(false);
    await endSession(token);
    expect(await isSession(token)).toBe(false);
  });

  it("12 時間で切れる", async () => {
    const token = await createSession(new Date(Date.now() - 13 * 3600_000));
    expect(await isSession(token)).toBe(false);
  });

  it("運営者用の API は、鍵の cookie でも入れる", async () => {
    const token = await createSession();
    const req = (cookie?: string, ip = "198.51.100.20") =>
      new NextRequest("https://takoshin.example/api/admin/inquiries", {
        headers: {
          "cf-connecting-ip": ip,
          ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}),
        },
      });
    expect(await requireAdmin(req(token))).toBeNull();
    expect((await requireAdmin(req("y".repeat(43))))?.status).toBe(401);
    // 何も送っていないときは 401 だが、まちがいとしては数えない（ページを開くたびに止まらないように）
    for (let i = 0; i < 12; i++)
      expect(
        (await requireAdmin(req(undefined, "198.51.100.21")))?.status,
      ).toBe(401);
    expect(await requireAdmin(req(token, "198.51.100.21"))).toBeNull();
  });
});
