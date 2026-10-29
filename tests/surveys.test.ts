// 診断の作成・回答の受付・確定（仕様書 §5・§11・§14）
// DATABASE_URL があれば本物の PostgreSQL、なければ PGlite で動かす。
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  cleanup,
  createSurvey,
  deleteSurvey,
  extendSurvey,
  getHost,
  getPublic,
  getShared,
  raiseTarget,
  saveSelf,
  setShare,
  submitResponse,
} from "../src/lib/surveys";
import { QUESTIONS } from "../src/data/questions";

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
  await db.exec("delete from responses; delete from surveys;");
});

afterAll(async () => {
  await db.close();
});

// 全問 v（どの軸も半々に近いので、深掘りの問まで 32 問すべてに答える）
const answers = (v = 6) => Array(QUESTIONS.length).fill(v);

async function make(n = 3, now = new Date()) {
  const r = await createSurvey({ nickname: "たろう", targetCount: n }, now);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("作る", () => {
  it("呼び名と人数を確かめる", async () => {
    expect(await createSurvey({ nickname: "", targetCount: 5 })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(
      await createSurvey({
        nickname: "あいうえおかきくけこさしす",
        targetCount: 5,
      }),
    ).toEqual({ ok: false, error: "too_long" });
    expect(await createSurvey({ nickname: "たろう", targetCount: 2 })).toEqual({
      ok: false,
      error: "bad_target",
    });
    expect(await createSurvey({ nickname: "たろう", targetCount: 31 })).toEqual(
      {
        ok: false,
        error: "bad_target",
      },
    );
    expect(
      await createSurvey({ nickname: "たろう", targetCount: 3.5 }),
    ).toEqual({
      ok: false,
      error: "bad_target",
    });
    expect(await createSurvey({ nickname: "バカ", targetCount: 5 })).toEqual({
      ok: false,
      error: "ng_word",
    });
    expect(
      (await createSurvey({ nickname: "かすみ", targetCount: 5 })).ok,
    ).toBe(true);
  });

  it("T-11 HTML の記号はそのまま文字として保存する", async () => {
    const r = await createSurvey({ nickname: "<script>", targetCount: 3 });
    if (!r.ok) throw new Error();
    expect((await getPublic(r.surveyId))!.nickname).toBe("<script>");
  });

  it("管理用の鍵はそのまま保存しない", async () => {
    const { hostKey } = await make();
    const { rows } = await db.query<{ host_key_hash: string }>(
      "select host_key_hash from surveys",
    );
    expect(rows[0].host_key_hash).not.toBe(hostKey);
    expect(rows[0].host_key_hash).toHaveLength(64);
  });
});

describe("T-6 そろうまで結果を出さない", () => {
  it("2 人目まで結果なし、3 人目で確定", async () => {
    const { surveyId, hostKey } = await make(3);
    expect(
      (await submitResponse(surveyId, { answers: answers() }, "a")).status,
    ).toBe("accepted");
    expect(
      (await submitResponse(surveyId, { answers: answers() }, "b")).status,
    ).toBe("accepted");
    const mid = await getHost(hostKey);
    expect(mid).toMatchObject({
      status: "open",
      responseCount: 2,
      result: null,
    });
    expect(await getPublic(surveyId)).toMatchObject({ remaining: 1 });
    const last = await submitResponse(surveyId, { answers: answers() }, "c");
    expect(last.status).toBe("completed");
    const done = await getHost(hostKey);
    expect(done!.status).toBe("completed");
    expect(done!.result!.n).toBe(3);
    expect(done!.deleteAt).not.toBeNull();
    // 散らばりは結果が出たときだけ、軸ごとに返す
    expect(mid!.spreads).toBeNull();
    expect(done!.spreads).toHaveLength(4);
  });
});

describe("版 1 の問で出た結果", () => {
  it("散らばりは出さない（保存した回答の並びが、いまの版の問とちがうため）", async () => {
    const { surveyId, hostKey } = await make(3);
    for (const k of ["a", "b", "c"])
      await submitResponse(surveyId, { answers: answers() }, k);
    expect((await getHost(hostKey))!.spreads).toHaveLength(4);
    await db.query(`update surveys set question_version = 1 where id = $1`, [
      surveyId,
    ]);
    const old = (await getHost(hostKey))!;
    expect(old.result).not.toBeNull();
    expect(old.spreads).toBeNull();
  });
});

describe("T-7 残り 1 枠に同時に送る", () => {
  it("受付 1 件・締め切り 9 件・3 人で確定", async () => {
    const { surveyId, hostKey } = await make(3);
    await submitResponse(surveyId, { answers: answers() }, "a");
    await submitResponse(surveyId, { answers: answers() }, "b");
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        submitResponse(surveyId, { answers: answers(2) }, `x${i}`),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === "completed")).toHaveLength(1);
    expect(statuses.filter((s) => s === "closed")).toHaveLength(9);
    const { rows } = await db.query<{ c: string | number }>(
      "select count(*) as c from responses where survey_id = $1",
      [surveyId],
    );
    expect(Number(rows[0].c)).toBe(3);
    const host = await getHost(hostKey);
    expect(host!.responseCount).toBe(3);
    expect(host!.result!.n).toBe(3);
  });
});

describe("T-8 同じ端末から 2 回", () => {
  it("2 回目は duplicate", async () => {
    const { surveyId } = await make(3);
    await submitResponse(surveyId, { answers: answers() }, "a");
    expect(
      (await submitResponse(surveyId, { answers: answers() }, "a")).status,
    ).toBe("duplicate");
  });
});

describe("回答の受付", () => {
  it("形のおかしい回答・存在しない診断", async () => {
    const { surveyId } = await make(3);
    expect(
      (await submitResponse(surveyId, { answers: [1, 2] }, "a")).status,
    ).toBe("invalid");
    expect(
      (await submitResponse("nope", { answers: answers() }, "a")).status,
    ).toBe("not_found");
  });
  it("知らない関係は保存しない", async () => {
    const { surveyId } = await make(3);
    await submitResponse(
      surveyId,
      { answers: answers(), relation: "<x>" },
      "a",
    );
    await submitResponse(
      surveyId,
      { answers: answers(), relation: "school" },
      "b",
    );
    const { rows } = await db.query<{ relation: string | null }>(
      "select relation from responses order by id",
    );
    expect(rows.map((r) => r.relation)).toEqual([null, "school"]);
  });
});

describe("T-9 自己回答", () => {
  it("受付中は保存でき、結果に使われる。確定後は断る", async () => {
    const { surveyId, hostKey } = await make(3);
    expect(await saveSelf(hostKey, answers(2))).toBe("ok");
    expect(await saveSelf(hostKey, [...answers(2).slice(1), 0])).toBe(
      "invalid",
    );
    for (const k of ["a", "b", "c"]) {
      await submitResponse(surveyId, { answers: answers() }, k);
    }
    const host = await getHost(hostKey);
    expect(host!.result!.self).not.toBeNull();
    expect(await saveSelf(hostKey, answers(3))).toBe("not_open");
  });
});

describe("期限", () => {
  const day = 24 * 60 * 60 * 1000;
  it("30 日で期限切れ、1 回だけ 30 日延長", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    const { surveyId, hostKey } = await make(3, t0);
    const d29 = new Date(t0.getTime() + 29 * day);
    expect(await extendSurvey(hostKey, d29)).toBe("ok");
    expect(await extendSurvey(hostKey, d29)).toBe("already");
    const d59 = new Date(t0.getTime() + 59 * day);
    expect((await getPublic(surveyId, d59))!.status).toBe("open");
    const d60 = new Date(t0.getTime() + 60 * day);
    expect((await getPublic(surveyId, d60))!.status).toBe("expired");
    expect(
      (await submitResponse(surveyId, { answers: answers() }, "a", d60)).status,
    ).toBe("expired");
  });

  it("古い版の問で作った診断は、受付中でも期限切れとして扱う", async () => {
    const { surveyId, hostKey } = await make(3);
    await db.query(`update surveys set question_version = 1 where id = $1`, [
      surveyId,
    ]);
    expect((await getPublic(surveyId))!.status).toBe("expired");
    expect((await getHost(hostKey))!.status).toBe("expired");
    expect(
      (await submitResponse(surveyId, { answers: answers() }, "a")).status,
    ).toBe("expired");
    expect(await extendSurvey(hostKey)).not.toBe("ok");
  });

  it("T-15 定時処理：期限切れにし、保存期限で消す", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    const open = await make(3, t0);
    const done = await make(3, t0);
    for (const k of ["a", "b", "c"]) {
      await submitResponse(done.surveyId, { answers: answers() }, k, t0);
    }
    const d31 = new Date(t0.getTime() + 31 * day);
    expect(await cleanup(d31)).toEqual({ expired: 1, deleted: 0 });
    expect((await getHost(open.hostKey))!.status).toBe("expired");
    // 期限切れは 30 日後に消える
    expect((await cleanup(new Date(d31.getTime() + 30 * day))).deleted).toBe(1);
    expect(await getHost(open.hostKey)).toBeNull();
    // 確定した診断は確定から 180 日で消える
    expect((await cleanup(new Date(t0.getTime() + 179 * day))).deleted).toBe(0);
    expect((await cleanup(new Date(t0.getTime() + 180 * day))).deleted).toBe(1);
    expect(await getHost(done.hostKey)).toBeNull();
  });
});

describe("公開と削除", () => {
  it("確定後だけ公開でき、取り消せる。公開の中身はシェア画像と同じだけ", async () => {
    const { surveyId, hostKey } = await make(3);
    expect((await setShare(hostKey, true)).status).toBe("not_open");
    for (const k of ["a", "b", "c"]) {
      await submitResponse(surveyId, { answers: answers() }, k);
    }
    const on = await setShare(hostKey, true);
    expect(on.status).toBe("ok");
    const shared = await getShared(on.shareId!);
    expect(Object.keys(shared!).sort()).toEqual([
      "axes",
      "n",
      "nickname",
      "type",
    ]);
    expect((await setShare(hostKey, false)).shareId).toBeNull();
    expect(await getShared(on.shareId!)).toBeNull();
  });
  it("消すと回答ごと消える", async () => {
    const { surveyId, hostKey } = await make(3);
    await submitResponse(surveyId, { answers: answers() }, "a");
    expect(await deleteSurvey(hostKey)).toBe("ok");
    expect(await getPublic(surveyId)).toBeNull();
    const { rows } = await db.query("select * from responses");
    expect(rows).toHaveLength(0);
  });
});

describe("§5.4 人数をふやす", () => {
  it("受付中は 1 人以上、上限 30 人まで", async () => {
    const { hostKey } = await make(3);
    expect((await getHost(hostKey))!.raiseMin).toBe(4);
    expect(await raiseTarget(hostKey, 3)).toBe("invalid");
    expect(await raiseTarget(hostKey, 31)).toBe("invalid");
    expect(await raiseTarget(hostKey, "x")).toBe("invalid");
    expect(await raiseTarget(hostKey, 4)).toBe("ok");
    const host = (await getHost(hostKey))!;
    expect(host).toMatchObject({ status: "open", targetCount: 4 });
  });

  it("結果が出たあとは 3 人以上ふやし、前の回答を引き継いで結果を出し直す", async () => {
    const { surveyId, hostKey } = await make(3);
    for (const k of ["a", "b", "c"]) {
      await submitResponse(surveyId, { answers: answers() }, k);
    }
    await setShare(hostKey, true);
    expect((await getHost(hostKey))!.raiseMin).toBe(6);
    expect(await raiseTarget(hostKey, 5)).toBe("invalid");
    expect(await raiseTarget(hostKey, 6)).toBe("ok");
    const reopened = (await getHost(hostKey))!;
    expect(reopened).toMatchObject({
      status: "open",
      targetCount: 6,
      responseCount: 3,
      result: null,
      shareId: null,
      extended: false,
    });
    // 前に答えた人は、もう一度は答えられない
    expect(
      (await submitResponse(surveyId, { answers: answers() }, "a")).status,
    ).toBe("duplicate");
    for (const k of ["d", "e"]) {
      await submitResponse(surveyId, { answers: answers() }, k);
    }
    expect((await getHost(hostKey))!.result).toBeNull();
    await submitResponse(surveyId, { answers: answers() }, "f");
    const done = (await getHost(hostKey))!;
    expect(done.status).toBe("completed");
    expect(done.result!.n).toBe(6);
  });

  it("期限切れ・古い版・上限をこえる場合はふやせない", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    const expired = await make(3, t0);
    const d31 = new Date(t0.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(await raiseTarget(expired.hostKey, 4, d31)).toBe("not_open");

    const old = await make(3);
    await db.query(`update surveys set question_version = 1 where id = $1`, [
      old.surveyId,
    ]);
    expect(await raiseTarget(old.hostKey, 4)).toBe("not_open");

    const big = await make(3);
    for (const k of ["a", "b", "c"]) {
      await submitResponse(big.surveyId, { answers: answers() }, k);
    }
    await db.query(`update surveys set target_count = 28 where id = $1`, [
      big.surveyId,
    ]);
    expect((await getHost(big.hostKey))!.raiseMin).toBeNull();
    expect(await raiseTarget(big.hostKey, 30)).toBe("not_open");
    expect(await raiseTarget("nope", 5)).toBe("not_found");
  });
});
