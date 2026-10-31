// データベースへの入口。DATABASE_URL があれば PostgreSQL（pg）、なければ PGlite
//（同じ SQL が動く、組み込みの PostgreSQL）を使う。PGlite は開発とテスト用。

import { MIGRATIONS, SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export interface Queryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

// トランザクションの中。複数の文をまとめて実行する exec も使える（引数なし）
export interface Tx extends Queryable {
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  // 複数の文をまとめて実行する（引数なし）
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
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
        const tx: Tx = {
          async query(sql, params) {
            const r = await client.query(sql, params as unknown[]);
            return { rows: r.rows };
          },
          async exec(sql) {
            await client.query(sql);
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
  const wrap = (c: InstanceType<typeof Client>): Tx => ({
    async query(sql, params) {
      const r = await c.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
    async exec(sql) {
      await c.query(sql);
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
          async exec(sql) {
            await t.exec(sql);
          },
        }),
      );
    },
    async close() {
      await pg.close();
    },
  };
}

// 版の番号を読む。まだ表がなければ 0（版の番号を使う前のデータベース・新しいデータベース）
async function schemaVersion(q: Queryable): Promise<number> {
  try {
    const { rows } = await q.query<{ version: number }>(
      `select version from schema_meta where id = 1`,
    );
    return rows[0] ? Number(rows[0].version) : 0;
  } catch (e) {
    // 42P01：表がない
    if ((e as { code?: string }).code === "42P01") return 0;
    throw e;
  }
}

// 表を作り直すときの、ほかの isolate との順番待ちの鍵（pg_advisory_xact_lock の番号。ほかの用途と重ならない数）
const MIGRATE_LOCK = 7_342_118_001;

// データベースの形を今の版にそろえる。
// ふだん（もう今の版）は、版の番号を 1 回読むだけで終わる。`alter table ... add column if not exists` は、
// 列があっても表全体に強い鍵（AccessExclusiveLock）をかけ、そのあいだ診断の読み書きがすべて止まるため、
// 起動のたびには流さない。古いときだけ、1 つのトランザクションで、ほかの isolate と順番を待ってから流す
export async function migrate(db: Db): Promise<void> {
  if ((await schemaVersion(db)) >= SCHEMA_VERSION) return;
  await db.transaction(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock($1)`, [MIGRATE_LOCK]);
    // 待っているあいだに、ほかの isolate が済ませたかもしれない。表がないと、ここでエラーにして
    // トランザクションが使えなくなるので、先に（なければ）作る
    await tx.exec(`create table if not exists schema_meta (
      id smallint primary key check (id = 1),
      version integer not null,
      cleanup_ok_at timestamptz null
    )`);
    const current = await schemaVersion(tx);
    if (current >= SCHEMA_VERSION) return;
    await tx.exec(SCHEMA_SQL);
    for (const m of MIGRATIONS) {
      if (m.version > current && m.sql.trim()) await tx.exec(m.sql);
    }
    await tx.query(
      `insert into schema_meta (id, version) values (1, $1)
       on conflict (id) do update set version = excluded.version`,
      [SCHEMA_VERSION],
    );
  });
}

// 定時処理（/api/cron/cleanup）がすべて済んだ日時を覚える
export async function recordCleanupSuccess(
  q: Queryable,
  now = new Date(),
): Promise<void> {
  await q.query(`update schema_meta set cleanup_ok_at = $1 where id = 1`, [
    now,
  ]);
}

// 定時処理が最後にすべて済んだ日時（まだ一度もなければ null）
export async function lastCleanupSuccess(q: Queryable): Promise<Date | null> {
  const { rows } = await q.query<{ cleanup_ok_at: Date | string | null }>(
    `select cleanup_ok_at from schema_meta where id = 1`,
  );
  const v = rows[0]?.cleanup_ok_at;
  return v ? new Date(v) : null;
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
    // 失敗を覚えたままにしない（一時的な障害で、この isolate がずっとつながらなくなるため）。次の呼び出しで作り直す
    const pending = globalForDb.__takoshinDb;
    pending.catch(() => {
      if (globalForDb.__takoshinDb === pending)
        globalForDb.__takoshinDb = undefined;
    });
  }
  return globalForDb.__takoshinDb;
}

// テストで差し替えるため
export function setDbForTest(db: Db): void {
  globalForDb.__takoshinDb = Promise.resolve(db);
}
