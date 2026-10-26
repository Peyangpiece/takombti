// どの送り方で開かれたかの件数（仕様書 §8.1）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  cleanupVisits,
  isBot,
  jstDay,
  recordVisit,
  summarizeVisits,
} from "../src/lib/visits";
import { withFrom } from "../src/lib/client";
import { POST } from "../src/app/api/visit/route";

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
  await db.exec("delete from visit_counts;");
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) await db.close();
});

const BROWSER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

function visit(body: unknown, ip: string, ua = BROWSER) {
  return POST(
    new NextRequest("https://takoshin.example/api/visit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": ua,
        "cf-connecting-ip": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("日付", () => {
  it("日本時間の日付で数える", () => {
    expect(jstDay(new Date("2026-10-26T14:59:59Z"))).toBe("2026-10-26");
    expect(jstDay(new Date("2026-10-26T15:00:00Z"))).toBe("2026-10-27");
  });
});

describe("機械による読み込み", () => {
  it("リンクの見出しを作る仕組みや検索エンジンは数えない", () => {
    expect(isBot("facebookexternalhit/1.1;line-poker/1.0")).toBe(true);
    expect(isBot("Twitterbot/1.0")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot(BROWSER)).toBe(false);
  });
});

describe("件数", () => {
  it("同じ日・ページ・送り方はまとめて数え、期間で合計する", async () => {
    const now = new Date("2026-10-26T03:00:00Z");
    await recordVisit("invite", "line", now);
    await recordVisit("invite", "line", now);
    await recordVisit("invite", "qr", now);
    await recordVisit("public", "x", now);
    // 10 日前は 7 日の合計に入らず、30 日の合計に入る
    await recordVisit("invite", "line", new Date(now.getTime() - 10 * 864e5));
    const week = await summarizeVisits(7, now);
    expect(week.counts.invite.line).toBe(2);
    expect(week.counts.invite.qr).toBe(1);
    expect(week.counts.public.x).toBe(1);
    expect(week.counts.top.line).toBe(0);
    expect((await summarizeVisits(30, now)).counts.invite.line).toBe(3);
  });

  it("400 日より前の件数は消す", async () => {
    const now = new Date("2026-10-26T03:00:00Z");
    await recordVisit("invite", "copy", new Date(now.getTime() - 401 * 864e5));
    await recordVisit("invite", "copy", new Date(now.getTime() - 399 * 864e5));
    expect(await cleanupVisits(now)).toBe(1);
  });
});

describe("受け付け（/api/visit）", () => {
  it("決まった送り方だけ数え、目印がなければ「目印なし」にする", async () => {
    expect(
      (await visit({ page: "invite", from: "line" }, "192.0.2.1")).status,
    ).toBe(204);
    await visit({ page: "invite", from: null }, "192.0.2.1");
    await visit({ page: "invite", from: "evil" }, "192.0.2.1");
    await visit({ page: "nope", from: "line" }, "192.0.2.1");
    const s = await summarizeVisits(1);
    expect(s.counts.invite.line).toBe(1);
    expect(s.counts.invite.none).toBe(1);
  });

  it("トップは目印があるときだけ数え、機械は数えない", async () => {
    await visit({ page: "top", from: null }, "192.0.2.2");
    await visit({ page: "top", from: "x" }, "192.0.2.2");
    await visit(
      { page: "public", from: "line" },
      "192.0.2.2",
      "Twitterbot/1.0",
    );
    const s = await summarizeVisits(1);
    expect(s.counts.top.none).toBe(0);
    expect(s.counts.top.x).toBe(1);
    expect(s.counts.public.line).toBe(0);
  });

  it("同じ回線から同じページは 1 時間に 10 件まで", async () => {
    for (let i = 0; i < 12; i++)
      await visit({ page: "public", from: "copy" }, "192.0.2.3");
    expect((await summarizeVisits(1)).counts.public.copy).toBe(10);
  });
});

describe("目印の付け方", () => {
  it("?from= を付ける", () => {
    expect(withFrom("https://t.example/a/abc", "line")).toBe(
      "https://t.example/a/abc?from=line",
    );
    expect(withFrom("https://t.example/?x=1", "qr")).toBe(
      "https://t.example/?x=1&from=qr",
    );
    expect(withFrom("", "copy")).toBe("");
  });
});
