// 安全のための決まり（仕様書 §8.4・§8.6）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import { NextRequest } from "next/server";
import { guardRequest } from "../src/lib/guard";
import {
  allowResponse,
  cleanupRateLimits,
  clientIp,
  ipKeyPart,
  isId,
  isLimited,
  RATE_LIMIT,
  undoCount,
} from "../src/lib/http";
import { requireAdmin } from "../src/lib/admin";
import { secretMatches } from "../src/lib/inquiries";
import { checkNickname, containsNgWord } from "../src/lib/text";

const req = (headers: Record<string, string>) =>
  new NextRequest("https://takoshin.example/api/x", { headers });

describe("接続元の IP", () => {
  it("Cloudflare の CF-Connecting-IP を、利用者が送れる X-Forwarded-For より先に使う", () => {
    expect(
      clientIp(
        req({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "1.2.3.4, 203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
  });
  it("Cloudflare を通らないときは X-Forwarded-For の先頭", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });
});

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

describe("呼び名の長さ", () => {
  it("見た目は 12 文字でも、結合文字を重ねて長くしたものは断る", () => {
    const stacked = ("た" + "\u0301".repeat(500)).repeat(12);
    expect(checkNickname(stacked).error).toBe("too_long");
    // 絵文字の組み合わせ（1 文字で 7〜11 の文字コード）は 12 文字まで使える
    const families = "👨‍👩‍👧‍👦".repeat(12);
    expect(checkNickname(families).error).toBeNull();
  });
});

describe("回数の制限", () => {
  it("isLimited は数えずに、上限に達したかだけを見る", async () => {
    const ip = "198.51.100.1";
    for (let i = 0; i < RATE_LIMIT - 1; i++) await allowResponse(ip, "t-limit");
    expect(await isLimited(ip, "t-limit")).toBe(false);
    expect(await isLimited(ip, "t-limit")).toBe(false);
    await allowResponse(ip, "t-limit");
    expect(await isLimited(ip, "t-limit")).toBe(true);
  });

  it("データベースで数える（どの isolate で受けても同じ数）。1 時間たてば数え直し、古い記録は消す", async () => {
    const ip = "198.51.100.9";
    const t0 = Date.parse("2026-01-01T00:00:00Z");
    for (let i = 0; i < RATE_LIMIT; i++)
      expect(await allowResponse(ip, "t-window", t0 + i)).toBe(true);
    expect(await allowResponse(ip, "t-window", t0 + 100)).toBe(false);
    // 上限をこえた 1 回も数えているので、2 回取り消すと 1 回分あく
    await undoCount(ip, "t-window");
    await undoCount(ip, "t-window");
    expect(await allowResponse(ip, "t-window", t0 + 200)).toBe(true);
    // 1 時間たつと数え直す
    expect(await allowResponse(ip, "t-window", t0 + 60 * 60 * 1000 + 1)).toBe(
      true,
    );
    expect(await cleanupRateLimits(t0 + 3 * 60 * 60 * 1000)).toBeGreaterThan(0);
    // IP アドレスそのものは保存しない
    const { rows } = await db.query<{ key: string }>(
      `select key from rate_limits`,
    );
    expect(rows.every((r) => !r.key.includes("198.51"))).toBe(true);
  });

  it("IPv6 は /64 でまとめて数える（範囲の中でアドレスを変えてもすり抜けられない）", async () => {
    expect(ipKeyPart("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(ipKeyPart("2001:db8:1:2:ffff:1:2:3")).toBe("2001:db8:1:2::/64");
    expect(ipKeyPart("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipKeyPart("203.0.113.5")).toBe("203.0.113.5");
    for (let i = 0; i < RATE_LIMIT; i++)
      await allowResponse(`2001:db8:9:9::${i + 1}`, "t-v6");
    expect(await isLimited("2001:db8:9:9::ffff", "t-v6")).toBe(true);
  });

  it("運営者の合言葉は、止めている間は正しくても通さない（総当たりを防ぐ）", async () => {
    const secret = "s".repeat(32);
    const prev = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = secret;
    try {
      const ip = { "cf-connecting-ip": "198.51.100.2" };
      for (let i = 0; i < RATE_LIMIT; i++)
        expect(
          (
            await requireAdmin(
              req({ ...ip, "x-admin-token": "wrong-token-xxxxxxxx" }),
            )
          )?.status,
        ).toBe(401);
      expect(
        (await requireAdmin(req({ ...ip, "x-admin-token": secret })))?.status,
      ).toBe(429);
      // ほかの回線からは、正しい合言葉で入れる
      expect(
        await requireAdmin(
          req({ "cf-connecting-ip": "198.51.100.3", "x-admin-token": secret }),
        ),
      ).toBeNull();
    } finally {
      process.env.ADMIN_TOKEN = prev;
    }
  });
});

describe("合言葉の比べ方", () => {
  it("一致したときだけ通し、短すぎる合言葉は設定のまちがいとして通さない", () => {
    const secret = "c".repeat(24);
    expect(secretMatches(secret, secret)).toBe(true);
    expect(secretMatches(secret.slice(1), secret)).toBe(false);
    expect(secretMatches(null, secret)).toBe(false);
    expect(secretMatches("short", "short")).toBe(false);
    expect(secretMatches("x".repeat(20), undefined)).toBe(false);
  });
});

describe("ID の形", () => {
  it("URL に使える文字で 16〜64 文字だけを通す", () => {
    expect(isId("abcdefghijklmnop_-12")).toBe(true);
    expect(isId("short")).toBe(false);
    expect(isId("abcdefghijklmnop; Path=/")).toBe(false);
  });
});

// 見えない文字（そのまま書くと読めないので、番号で作る）
const ZWSP = String.fromCodePoint(0x200b); // 幅のない空白
const RLO = String.fromCodePoint(0x202e); // 右から左へ向きを変える
const ZWJ = String.fromCodePoint(0x200d); // 絵文字をつなぐ
const WJ = String.fromCodePoint(0x2060); // 改行させない

describe("呼び名の見えない文字", () => {
  it("見えない文字や向きを変える文字は取り除く", () => {
    expect(checkNickname(`た${ZWSP}ろ${RLO}う`).value).toBe("たろう");
  });
  it("見えない文字を挟んでも禁止語の確かめをすり抜けない", () => {
    const ng = "しね";
    expect(containsNgWord(ng)).toBe(true);
    expect(containsNgWord(`し${ZWJ}ね`)).toBe(true);
    expect(checkNickname(`し${WJ}ね`).error).toBe("ng_word");
  });
  it("絵文字をつなぐ文字（ZWJ）は残す", () => {
    expect(checkNickname(`👨${ZWJ}👩${ZWJ}👧`).value).toBe(
      `👨${ZWJ}👩${ZWJ}👧`,
    );
  });
});

describe("呼び名の禁止語", () => {
  it("漢字の悪口と、名前に付けた短い悪口を止める", () => {
    for (const n of [
      "死ね",
      "馬鹿太郎",
      "デブ田中",
      "田中ブス",
      "ブスの花子",
      "ばかたろう",
    ])
      expect(containsNgWord(n)).toBe(true);
  });
  it("名前やあだ名の一部になりうる言葉は止めない", () => {
    for (const n of [
      "かすみ",
      "くずは",
      "こぶた",
      "ちびまる",
      "たろう",
      "はなこ",
    ])
      expect(containsNgWord(n)).toBe(false);
  });
});

describe("Workers の入口の決まり", () => {
  it("ブラウザが http で来たら https へ移す", () => {
    const r = guardRequest(
      new Request("http://takoshin.example/a/x?y=1", {
        headers: { "x-forwarded-proto": "http" },
      }),
    );
    expect(r?.status).toBe(301);
    expect(r?.headers.get("location")).toBe("https://takoshin.example/a/x?y=1");
    // https で来たとき・見出しがないとき（手元）は移さない
    expect(
      guardRequest(
        new Request("http://takoshin.example/", {
          headers: { "x-forwarded-proto": "https" },
        }),
      ),
    ).toBeNull();
    expect(guardRequest(new Request("http://localhost:8787/"))).toBeNull();
    expect(
      guardRequest(
        new Request("http://takoshin.example/", {
          headers: { "cf-visitor": '{"scheme":"http"}' },
        }),
      )?.status,
    ).toBe(301);
    expect(
      guardRequest(
        new Request("http://takoshin.example/", {
          headers: {
            "cf-visitor": '{"scheme":"https"}',
            "x-forwarded-proto": "http",
          },
        }),
      ),
    ).toBeNull();
  });
  it("よそのサイトからの書き込みは断り、同じサイトからと読み取りは通す", () => {
    const post = (headers: Record<string, string>) =>
      guardRequest(
        new Request("https://takoshin.example/api/surveys", {
          method: "POST",
          headers,
        }),
      );
    expect(post({ "sec-fetch-site": "cross-site" })?.status).toBe(403);
    expect(post({ "sec-fetch-site": "same-origin" })).toBeNull();
    expect(post({ origin: "https://evil.example" })?.status).toBe(403);
    expect(post({ origin: "https://takoshin.example" })).toBeNull();
    expect(post({ origin: "http://takoshin.example" })).toBeNull();
    expect(post({ origin: "null" })?.status).toBe(403);
    expect(post({})).toBeNull();
    expect(
      guardRequest(
        new Request("https://takoshin.example/api/og/x", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBeNull();
  });
});
