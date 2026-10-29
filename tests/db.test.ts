// データベースのつなぎ方（仕様書 §11）
import { describe, expect, it } from "vitest";

describe("getDb", () => {
  it("つなぐのに失敗しても、覚えたままにせず、次の呼び出しで作り直す", async () => {
    const g = globalThis as { __takoshinDb?: Promise<unknown> };
    const saved = g.__takoshinDb;
    const before = process.env.PGLITE_DIR;
    const url = process.env.DATABASE_URL;
    try {
      g.__takoshinDb = undefined;
      // CI では Postgres につなぐので、この確かめのあいだだけ外す
      delete process.env.DATABASE_URL;
      // ファイルの中にはデータベースを作れない
      process.env.PGLITE_DIR = "/dev/null/takoshin";
      const { getDb } = await import("../src/lib/db");
      await expect(getDb()).rejects.toBeTruthy();
      await new Promise((r) => setTimeout(r, 0));
      expect(g.__takoshinDb).toBeUndefined();
    } finally {
      g.__takoshinDb = saved;
      if (url !== undefined) process.env.DATABASE_URL = url;
      if (before === undefined) delete process.env.PGLITE_DIR;
      else process.env.PGLITE_DIR = before;
    }
  });
});
