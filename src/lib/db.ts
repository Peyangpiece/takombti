// データベースへの入口。DATABASE_URL があれば PostgreSQL（pg）、なければ PGlite
//（同じ SQL が動く、組み込みの PostgreSQL）を使う。PGlite は開発とテスト用。

import { SCHEMA_SQL } from "./schema";

export interface Queryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  // 複数の文をまとめて実行する（引数なし）
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

async function createPgDb(url: string): Promise<Db> {
  const { Pool } = (await import("pg")).default;
  const pool = new Pool({ connectionString: url, max: 5 });
  return {
    async query(sql, params) {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const tx: Queryable = {
          async query(sql, params) {
            const r = await client.query(sql, params as unknown[]);
            return { rows: r.rows };
          },
        };
        const out = await fn(tx);
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  return {
    async query(sql, params) {
      const r = await pg.query(sql, params as unknown[]);
      return { rows: r.rows as never[] };
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async transaction(fn) {
      return pg.transaction(async (t) =>
        fn({
          async query(sql, params) {
            const r = await t.query(sql, params as unknown[]);
            return { rows: r.rows as never[] };
          },
        }),
      );
    },
    async close() {
      await pg.close();
    },
  };
}

export async function migrate(db: Db): Promise<void> {
  await db.exec(SCHEMA_SQL);
}

const globalForDb = globalThis as unknown as { __takoshinDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__takoshinDb) {
    globalForDb.__takoshinDb = (async () => {
      const url = process.env.DATABASE_URL;
      const db = url
        ? await createPgDb(url)
        : await createPgliteDb(process.env.PGLITE_DIR ?? ".data/pglite");
      await migrate(db);
      return db;
    })();
  }
  return globalForDb.__takoshinDb;
}

// テストで差し替えるため
export function setDbForTest(db: Db): void {
  globalForDb.__takoshinDb = Promise.resolve(db);
}
