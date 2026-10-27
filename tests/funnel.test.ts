// 流入から診断の完成までの計測（仕様書 §11.11）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  cleanupFunnel,
  jstWeek,
  recordClientEvent,
  setStatsTest,
  summarizeFunnel,
} from "../src/lib/funnel";
import {
  createSurvey,
  deleteSurvey,
  markResultView,
  raiseTarget,
  setShare,
  submitResponse,
} from "../src/lib/surveys";
import { isClientEvent, answerTimeBucket } from "../src/data/funnel";
import {
  originFromParams,
  originFromReferrer,
  originFromUserAgent,
} from "../src/lib/track";
import { inviteMessage } from "../src/components/InviteShare";
import { QUESTIONS } from "../src/data/questions";

let db: Db;
beforeAll(async () => {
  db = await createPgliteDb();
  await migrate(db);
  setDbForTest(db);
});
beforeEach(async () => {
  await db.exec(
    "delete from responses; delete from surveys; delete from survey_stats; delete from funnel_counts;",
  );
});
afterAll(async () => {
  await db.close();
});

const all = (v = 6) => Array(QUESTIONS.length).fill(v);
const H = 60 * 60 * 1000;

async function counts() {
  const { rows } = await db.query<{
    event: string;
    key: string;
    test: boolean;
    count: number;
  }>(`select event, key, test, count from funnel_counts order by event, key`);
  return rows;
}

async function make(
  n = 3,
  now = new Date(),
  ctx: Partial<Parameters<typeof createSurvey>[2]> = {},
) {
  const r = await createSurvey({ nickname: "たろう", targetCount: n }, now, {
    origin: "line",
    campaign: null,
    entry: "thanks",
    test: false,
    ...ctx,
  });
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("サーバーで数える出来事", () => {
  it("作成・回答・完成・結果の表示・公開を、成功したときに 1 回ずつ数える", async () => {
    const t0 = new Date();
    const s = await make(3, t0);
    // 同じ回答者の送り直しは数えない
    await submitResponse(s.surveyId, { answers: all() }, "r1", t0, "copy");
    await submitResponse(s.surveyId, { answers: all() }, "r1", t0, "copy");
    await submitResponse(s.surveyId, { answers: all() }, "r2", t0, "line");
    await submitResponse(s.surveyId, { answers: all() }, "r3", t0, "line");
    // 結果の表示と公開は、何度でも 1 回だけ
    expect(await markResultView(s.hostKey)).toBe(true);
    expect(await markResultView(s.hostKey)).toBe(false);
    await setShare(s.hostKey, true);
    await setShare(s.hostKey, false);
    await setShare(s.hostKey, true);
    // 人数をふやして出し直しても、完成は 1 回だけ
    expect(await raiseTarget(s.hostKey, 6)).toBe("ok");
    for (const k of ["r4", "r5", "r6"])
      await submitResponse(s.surveyId, { answers: all() }, k, t0, "none");
    const c = await counts();
    const n = (event: string, key?: string) =>
      c
        .filter(
          (r) => r.event === event && (key === undefined || r.key === key),
        )
        .reduce((a, r) => a + Number(r.count), 0);
    expect(n("created", "line")).toBe(1);
    expect(n("response")).toBe(6);
    expect(n("response", "copy")).toBe(1);
    expect(n("completed")).toBe(1);
    expect(n("result_view")).toBe(1);
    expect(n("public_created")).toBe(1);
  });

  it("診断ごとの記録には、呼び名・回答・管理用の鍵・診断の ID を入れない", async () => {
    const s = await make();
    const { rows } = await db.query(`select * from survey_stats`);
    const text = JSON.stringify(rows);
    expect(text).not.toContain("たろう");
    expect(text).not.toContain(s.hostKey);
    expect(text).not.toContain(s.surveyId);
    // 診断を消すと、どの診断の記録かは分からなくなり、件数としてだけ残る
    await deleteSurvey(s.hostKey);
    expect((await db.query(`select * from survey_stats`)).rows).toHaveLength(1);
  });
});

describe("集計", () => {
  it("完成率の分母には、24 時間（7 日）たった診断だけを入れる", async () => {
    const now = new Date();
    const old = await make(3, new Date(now.getTime() - 30 * H));
    for (const k of ["a", "b", "c"])
      await submitResponse(
        old.surveyId,
        { answers: all() },
        k,
        new Date(now.getTime() - 29 * H),
      );
    await make(3, new Date(now.getTime() - 2 * H)); // まだ 24 時間たっていない
    const f = await summarizeFunnel({}, now);
    const total = f.cohorts.reduce(
      (a, c) => ({
        eligible: a.eligible + c.within24h.eligible,
        done: a.done + c.within24h.done,
        created: a.created + c.created,
      }),
      { eligible: 0, done: 0, created: 0 },
    );
    expect(total).toEqual({ eligible: 1, done: 1, created: 2 });
    expect(f.weeklyCompleted.reduce((a, w) => a + w.count, 0)).toBe(1);
    expect(f.byEntry).toEqual([
      {
        id: "thanks",
        created: 2,
        within7d: { eligible: 0, done: 0 },
        completed: 1,
      },
    ]);
    // 最初の回答まで 1 時間
    expect(
      f.cohorts.find((c) => c.firstResponseHours !== null)?.firstResponseHours,
    ).toBe(1);
  });

  it("テストは、含めると選んだときだけ数える", async () => {
    await make(3, new Date(), { test: true });
    const s = await make(3, new Date());
    await recordClientEvent("invite", "line", true);
    await recordClientEvent("invite", "line", false);
    let f = await summarizeFunnel();
    expect(f.cohorts.reduce((a, c) => a + c.created, 0)).toBe(1);
    expect(f.byKey.invite).toEqual({ line: 1 });
    f = await summarizeFunnel({ includeTests: true });
    expect(f.cohorts.reduce((a, c) => a + c.created, 0)).toBe(2);
    expect(f.byKey.invite).toEqual({ line: 2 });
    // あとからテストとして外せる
    expect(await setStatsTest(s.surveyId, true)).toBe(true);
    f = await summarizeFunnel();
    expect(f.cohorts.reduce((a, c) => a + c.created, 0)).toBe(0);
  });

  it("400 日より前の記録は消す", async () => {
    const now = new Date();
    await make(3, new Date(now.getTime() - 401 * 24 * H));
    await make(3, now);
    expect(await cleanupFunnel(now)).toBeGreaterThanOrEqual(1);
    expect((await db.query(`select * from survey_stats`)).rows).toHaveLength(1);
  });

  it("週は日本時間の月曜から", () => {
    // 2026-10-26（月）0:30 JST は 10-25 15:30 UTC
    expect(jstWeek(Date.UTC(2026, 9, 25, 15, 30))).toBe("2026-10-26");
    expect(jstWeek(Date.UTC(2026, 9, 25, 14, 30))).toBe("2026-10-19");
  });
});

describe("画面から受け付ける値", () => {
  it("決まった出来事と内訳だけ", () => {
    expect(isClientEvent("invite", "line")).toBe(true);
    expect(isClientEvent("invite", "facebook")).toBe(false);
    expect(isClientEvent("created", "line")).toBe(false); // サーバーで数えるもの
    expect(isClientEvent("toString", "x")).toBe(false);
    expect(answerTimeBucket(170)).toBe("lt3");
    expect(answerTimeBucket(400)).toBe("6to10");
  });
  it("流入元の判定", () => {
    expect(originFromParams(new URLSearchParams("from=line"))).toBe("line");
    expect(originFromParams(new URLSearchParams("utm_source=ig"))).toBe(
      "instagram",
    );
    expect(originFromParams(new URLSearchParams("from=evil"))).toBeNull();
    expect(originFromUserAgent("Mozilla/5.0 ... Instagram 300.0")).toBe(
      "instagram",
    );
    expect(originFromUserAgent("Mozilla/5.0 ... musical_ly_2023")).toBe(
      "tiktok",
    );
    expect(originFromUserAgent("Mozilla/5.0 ... Line/14.1.0")).toBe("line");
    expect(originFromUserAgent("Mozilla/5.0 Safari/605")).toBeNull();
    expect(originFromReferrer("https://l.instagram.com/?u=x", "a.com")).toBe(
      "instagram",
    );
    expect(originFromReferrer("https://t.co/abc", "a.com")).toBe("x");
    expect(originFromReferrer("https://www.google.co.jp/", "a.com")).toBe(
      "search",
    );
    expect(originFromReferrer("https://a.com/new", "a.com")).toBeNull();
    expect(originFromReferrer("https://blog.example/", "a.com")).toBe("other");
  });
});

describe("招待の文（§4.5）", () => {
  it("人数・時間・登録なし・だれが何と答えたかは見えないことを入れる", () => {
    const t = inviteMessage("https://x.example/a/ID", 3);
    expect(t).toContain("3人そろったら結果が出る");
    expect(t).toContain("約3〜6分・登録なし");
    expect(t).toContain("誰が何と答えたかは私には表示されません");
    expect(t).not.toContain("完全匿名");
    expect(t.endsWith("\nhttps://x.example/a/ID")).toBe(true);
    expect(t).not.toContain("ありがとう");
  });
  it("送り直しでは、もう答えてくれた人へのお礼を入れる", () => {
    expect(inviteMessage("", 5, 2)).toMatch(/^もう答えてくれた人はありがとう/);
  });
});
