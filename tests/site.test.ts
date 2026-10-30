// 検索からの入り口（タイプの紹介ページ・サイトの地図）と、動いているかの確かめ（仕様書 §4.14・§11.8）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPgliteDb,
  migrate,
  recordCleanupSuccess,
  setDbForTest,
  type Db,
} from "../src/lib/db";
import { TYPE_CODES } from "../src/data/framework";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
import { generateStaticParams } from "../src/app/types/[code]/page";
import { GET as health } from "../src/app/api/health/route";

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

describe("タイプの紹介ページとサイトの地図", () => {
  it("16 タイプすべてのページを、小文字の URL で作る", () => {
    const params = generateStaticParams().map((p) => p.code);
    expect(params).toHaveLength(16);
    expect(params).toContain("intj");
    expect(params.every((c) => c === c.toLowerCase())).toBe(true);
  });

  it("サイトの地図には、だれでも見られるページだけを載せる", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    for (const c of TYPE_CODES)
      expect(urls).toContain(`/types/${c.toLowerCase()}`);
    expect(urls).toContain("/");
    expect(urls.some((u) => /^\/(a|r|h|admin|api)(\/|$)/.test(u))).toBe(false);
  });

  it("robots.txt にサイトの地図の場所を書く", () => {
    expect(String(robots().sitemap)).toMatch(/\/sitemap\.xml$/);
  });
});

describe("動いているかの確かめ", () => {
  it("データベースに問い合わせられれば ok を返す（中身は返さない）", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("定時処理が 26 時間より長く済んでいなければ 503 を返す（一度も済んでいなければ確かめない）", async () => {
    try {
      await db.query(`update schema_meta set cleanup_ok_at = null`);
      expect((await health()).status).toBe(200);
      const hour = 60 * 60 * 1000;
      await recordCleanupSuccess(db, new Date(Date.now() - 25 * hour));
      expect((await health()).status).toBe(200);
      await recordCleanupSuccess(db, new Date(Date.now() - 27 * hour));
      const res = await health();
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false });
    } finally {
      await db.query(`update schema_meta set cleanup_ok_at = null`);
    }
  });
});
