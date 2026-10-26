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

// Cloudflare Workers では、通信の部品をリクエストをまたいで使い回せない。
// そのため、問い合わせごとに接続を作って閉じる（Hyperdrive を使うと接続は速い）
async function createPerRequestPgDb(
  getUrl: () => Promise<string>,
): Promise<Db> {
  const { Client } = (await import("pg")).default;
  async function withClient<T>(
    fn: (c: InstanceType<typeof Client>) => Promise<T>,
  ): Promise<T> {
    const client = new Client({ connectionString: await getUrl() });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      // 閉じたあとに、読み取りの待ちが「閉じられた」と知らせてくる。
      // 受け手がいないと処理されないエラーになるので、閉じる前に受け手を付けて捨てる
      client.on("error", () => {});
      await client.end().catch(() => {});
    }
  }
  const wrap = (c: InstanceType<typeof Client>): Queryable => ({
    async query(sql, params) {
      const r = await c.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
  });
  return {
    query: (sql, params) => withClient((c) => wrap(c).query(sql, params)),
    async exec(sql) {
      await withClient((c) => c.query(sql));
    },
    transaction: (fn) =>
      withClient(async (c) => {
        await c.query("begin");
        try {
          const out = await fn(wrap(c));
          await c.query("commit");
          return out;
        } catch (e) {
          await c.query("rollback").catch(() => {});
          throw e;
        }
      }),
    async close() {},
  };
}

export function isCloudflareWorkers(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}

// Hyperdrive（Cloudflare の接続の仲立ち）があればその接続文字列、なければ DATABASE_URL
async function workersDatabaseUrl(): Promise<string> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const env = getCloudflareContext().env as unknown as {
    HYPERDRIVE?: { connectionString: string };
  };
  const url = env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error("HYPERDRIVE か DATABASE_URL を設定してください");
  return url;
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
      const db = isCloudflareWorkers()
        ? await createPerRequestPgDb(workersDatabaseUrl)
        : url
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
