// 安全のための決まり（仕様書 §8.4・§8.6）
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { guardRequest } from "../src/lib/guard";
import {
  allowResponse,
  clientIp,
  isId,
  isLimited,
  RATE_LIMIT,
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

describe("回数の制限", () => {
  it("isLimited は数えずに、上限に達したかだけを見る", () => {
    const ip = "198.51.100.1";
    for (let i = 0; i < RATE_LIMIT - 1; i++) allowResponse(ip, "t-limit");
    expect(isLimited(ip, "t-limit")).toBe(false);
    expect(isLimited(ip, "t-limit")).toBe(false);
    allowResponse(ip, "t-limit");
    expect(isLimited(ip, "t-limit")).toBe(true);
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
