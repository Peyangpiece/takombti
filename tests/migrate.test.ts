// データベースの形の版（仕様書 §11.2）：ふだんは版の番号を読むだけで、古いときだけ 1 回そろえる。
// 前からあるデータベースを作り直して確かめるので、DATABASE_URL があっても PGlite で動かす
import { describe, expect, it } from "vitest";
import { createPgliteDb, migrate, type Db } from "../src/lib/db";
import { SCHEMA_SQL, SCHEMA_VERSION } from "../src/lib/schema";

// exec（複数の文。表の形をそろえるときだけ使う）が何回呼ばれたかを数える
function counting(db: Db) {
  const calls = { exec: 0 };
  const wrapped: Db = {
    ...db,
    query: db.query.bind(db),
    exec: async (sql) => {
      calls.exec++;
      await db.exec(sql);
    },
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          query: tx.query.bind(tx),
          exec: async (sql) => {
            calls.exec++;
            await tx.exec(sql);
          },
        }),
      ),
  };
  return { db: wrapped, calls };
}

async function version(db: Db): Promise<number> {
  const { rows } = await db.query<{ version: number }>(
    `select version from schema_meta where id = 1`,
  );
  return Number(rows[0].version);
}

describe("migrate", () => {
  it("新しいデータベースでは表を作って版の番号を書き、2 回目からは番号を読むだけにする", async () => {
    const raw = await createPgliteDb();
    try {
      const { db, calls } = counting(raw);
      await migrate(db);
      expect(await version(raw)).toBe(SCHEMA_VERSION);
      expect(calls.exec).toBeGreaterThan(0);
      calls.exec = 0;
      await migrate(db);
      await migrate(db);
      expect(calls.exec).toBe(0);
    } finally {
      await raw.close();
    }
  });

  it("同時に呼ばれても、そろえ終わる", async () => {
    const db = await createPgliteDb();
    try {
      await Promise.all([migrate(db), migrate(db), migrate(db)]);
      expect(await version(db)).toBe(SCHEMA_VERSION);
    } finally {
      await db.close();
    }
  });

  it("版の番号がない（前からある）データベースをそろえ、shown_counts と回答の日時を直す", async () => {
    const db = await createPgliteDb();
    try {
      // 版の番号を使う前の形（列はすべてあり、schema_meta がない）
      await db.exec(SCHEMA_SQL);
      await db.exec(`drop table schema_meta`);
      await db.exec(
        `alter table responses alter column created_at set default now()`,
      );
      const day = 24 * 60 * 60 * 1000;
      const t0 = new Date("2026-10-01T05:06:07.890Z");
      const later = new Date(t0.getTime() + 3 * day);
      await db.query(
        `insert into survey_stats (id, created_at, origin, entry, target_count, completed_at)
         values ('st-once', $1, 'none', 'top', 3, $1),
                ('st-again', $1, 'none', 'top', 3, $1),
                ('st-reopen', $1, 'none', 'top', 3, $1),
                ('st-open', $1, 'none', 'top', 3, null)`,
        [t0],
      );
      const add = (
        id: string,
        status: string,
        count: number,
        stats: string | null,
        completedAt: Date | null,
        shown = "{}",
      ) =>
        db.query(
          `insert into surveys (id, host_key_hash, nickname, target_count, response_count,
                                status, expires_at, completed_at, stats_id, shown_counts)
           values ($1, $1, 'たろう', greatest($3::smallint, 3), $3, $2, $4, $5, $6, $7)`,
          [
            id,
            status,
            count,
            new Date(t0.getTime() + 30 * day),
            completedAt,
            stats,
            shown,
          ],
        );
      // 1 回だけ結果を出した
      await add("once", "completed", 4, "st-once", t0);
      // 人数をふやして、出し直した（いまの結果より前にも完成していた）
      await add("again", "completed", 6, "st-again", later);
      // 人数をふやして、受付中に戻した
      await add("reopen", "open", 5, "st-reopen", null);
      // 一度も結果を出していない
      await add("fresh", "open", 2, "st-open", null);
      // もう埋まっている
      await add("filled", "completed", 3, null, t0, "{3}");
      await db.query(
        `insert into responses (survey_id, respondent_key, answers, created_at)
         values ('once', 'k1', '{1}', $1)`,
        [t0],
      );

      await migrate(db);

      expect(await version(db)).toBe(SCHEMA_VERSION);
      const { rows } = await db.query<{ id: string; shown_counts: number[] }>(
        `select id, shown_counts from surveys order by id`,
      );
      const shown = Object.fromEntries(
        rows.map((r) => [r.id, r.shown_counts.map(Number)]),
      );
      expect(shown).toEqual({
        once: [4],
        again: [3, 4, 5, 6],
        reopen: [3, 4, 5],
        fresh: [],
        filled: [3],
      });
      const r = await db.query<{ created_at: Date }>(
        `select created_at from responses`,
      );
      expect(new Date(r.rows[0].created_at).toISOString()).toBe(
        "2026-10-01T00:00:00.000Z",
      );
      // これから入る回答も、日にちまで
      await db.query(
        `insert into responses (survey_id, respondent_key, answers) values ('once', 'k2', '{1}')`,
      );
      const r2 = await db.query<{ sec: string | number }>(
        `select extract(epoch from created_at)::bigint % 86400 as sec
           from responses where respondent_key = 'k2'`,
      );
      expect(Number(r2.rows[0].sec)).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("版 1 のデータベースに、通知の送り先の role を足す（前からある行はホストの送り先）", async () => {
    const db = await createPgliteDb();
    try {
      // 版 1 の形（push_subscriptions に role がない）
      await db.exec(SCHEMA_SQL);
      await db.exec(`alter table push_subscriptions drop column role`);
      await db.exec(
        `insert into schema_meta (id, version) values (1, 1)
         on conflict (id) do update set version = 1`,
      );
      await db.query(
        `insert into surveys (id, host_key_hash, nickname, target_count, expires_at)
         values ('s1', 'h1', 'たろう', 3, now() + interval '30 days')`,
      );
      await db.query(
        `insert into push_subscriptions (survey_id, endpoint, p256dh, auth)
         values ('s1', 'https://fcm.googleapis.com/x', 'p', 'a')`,
      );

      await migrate(db);

      expect(await version(db)).toBe(SCHEMA_VERSION);
      expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
      const { rows } = await db.query<{ role: string }>(
        `select role from push_subscriptions`,
      );
      expect(rows).toEqual([{ role: "host" }]);
      // 決まった値のほかは入らない
      await expect(
        db.query(
          `insert into push_subscriptions (survey_id, endpoint, p256dh, auth, role)
           values ('s1', 'https://fcm.googleapis.com/y', 'p', 'a', 'other')`,
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
  it("版 2 のデータベースに、グループ診断の表と surveys.group_id を足す（前からある診断はグループなし）", async () => {
    const db = await createPgliteDb();
    try {
      // 版 2 の形（グループの表と surveys.group_id がない）
      await db.exec(SCHEMA_SQL);
      await db.exec(
        `alter table surveys drop column group_id;
         drop table group_members; drop table survey_groups;`,
      );
      await db.exec(
        `insert into schema_meta (id, version) values (1, 2)
         on conflict (id) do update set version = 2`,
      );
      await db.query(
        `insert into surveys (id, host_key_hash, nickname, target_count, expires_at)
         values ('s1', 'h1', 'たろう', 3, now() + interval '30 days')`,
      );

      await migrate(db);

      expect(await version(db)).toBe(SCHEMA_VERSION);
      expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
      const { rows } = await db.query<{ group_id: string | null }>(
        `select group_id from surveys`,
      );
      expect(rows).toEqual([{ group_id: null }]);
      await db.query(
        `insert into survey_groups (id, admin_key_hash, size, expires_at)
         values ('g1', 'a1', 4, now() + interval '30 days')`,
      );
      await db.query(
        `insert into group_members (group_id, member_no, nickname, host_key_hash, survey_id)
         values ('g1', 1, 'たろう', 'h1', 's1')`,
      );
      await db.query(`update surveys set group_id = 'g1' where id = 's1'`);
      // 人数は 4〜8 人だけ
      await expect(
        db.query(
          `insert into survey_groups (id, admin_key_hash, size, expires_at)
           values ('g2', 'a2', 3, now())`,
        ),
      ).rejects.toThrow();
      // 診断を消すと、メンバーの survey_id は null に戻り、グループは残る
      await db.query(`delete from surveys where id = 's1'`);
      const m = await db.query<{ survey_id: string | null }>(
        `select survey_id from group_members`,
      );
      expect(m.rows).toEqual([{ survey_id: null }]);
    } finally {
      await db.close();
    }
  });
});
