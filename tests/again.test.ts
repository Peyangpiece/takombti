// もう一度聞く（前回との比較。仕様書 §4.2・§4.11）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { axisChange, daysSince, monthDay } from "../src/lib/compare";
import {
  againFrom,
  againRecords,
  forgetAgainOf,
  previousOf,
  saveAgain,
  type AgainRecord,
} from "../src/lib/client";
import { suggestAgain } from "../src/app/MySurveys";
import { isEntry } from "../src/data/funnel";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  createSurvey,
  getHost,
  getHostSummary,
  submitResponse,
} from "../src/lib/surveys";
import { QUESTIONS } from "../src/data/questions";

const DAY = 24 * 60 * 60 * 1000;

describe("前回からの、軸ごとの変化", () => {
  const a = (pole: "E" | "I", percent: number, tie = false) => ({
    axis: "A1",
    pole,
    percent,
    tie,
  });
  it("同じ側なら割合だけ、入れかわったら極も出す", () => {
    expect(axisChange(a("E", 72), a("E", 61))).toEqual({
      text: "外向 72% → 61%",
      flipped: false,
    });
    expect(axisChange(a("E", 55), a("I", 60))).toEqual({
      text: "外向 55% → 内向 60%",
      flipped: true,
    });
  });
  it("ど真ん中は入れかわりとは言わない", () => {
    expect(axisChange(a("I", 50, true), a("E", 60))).toEqual({
      text: "どちらとも（50%） → 外向 60%",
      flipped: false,
    });
  });
  it("日付は日本時間の M月D日", () => {
    expect(monthDay("2026-07-31T15:30:00Z")).toBe("8月1日");
    expect(monthDay("2026-07-31T03:00:00Z")).toBe("7月31日");
    expect(monthDay("nope")).toBeNull();
  });
});

describe("トップの「前回から 3 か月。もう一度聞いてみる？」", () => {
  const now = new Date("2026-10-31T00:00:00Z");
  const done = (days: number) => ({
    status: "completed" as const,
    targetCount: 3,
    responseCount: 3,
    completedAt: new Date(now.getTime() - days * DAY).toISOString(),
  });
  it("結果が出てから 90 日たったときだけ", () => {
    expect(daysSince(done(90).completedAt, now)).toBe(90);
    expect(suggestAgain(done(89), false, now)).toBe(false);
    expect(suggestAgain(done(90), false, now)).toBe(true);
  });
  it("もう聞き直した・結果が出ていない・取れなかったときは出さない", () => {
    expect(suggestAgain(done(120), true, now)).toBe(false);
    expect(
      suggestAgain(
        { status: "open", targetCount: 3, responseCount: 1 },
        false,
        now,
      ),
    ).toBe(false);
    expect(suggestAgain("gone", false, now)).toBe(false);
    expect(suggestAgain(undefined, false, now)).toBe(false);
  });
});

describe("端末に覚える前回のまとめ", () => {
  const store = new Map<string, string>();
  beforeAll(() => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  beforeEach(() => store.clear());

  const rec = (prev: string, next: string): AgainRecord => ({
    prevSurveyId: prev,
    newSurveyId: next,
    type: "ESFJ",
    axes: ["A1", "A2", "A3", "A4"].map((axis) => ({
      axis,
      pole: "E",
      percent: 60,
      tie: false,
    })),
    date: "2026-07-31T03:00:00.000Z",
  });

  it("新しい診断から前回を、前回から新しい診断を引ける", () => {
    saveAgain(rec("p1", "n1"));
    saveAgain(rec("n1", "n2"));
    expect(previousOf("n1")?.prevSurveyId).toBe("p1");
    expect(previousOf("n2")?.prevSurveyId).toBe("n1");
    expect(againFrom("p1")?.newSurveyId).toBe("n1");
    expect(previousOf("p1")).toBeNull();
  });
  it("覚えるのは 4 文字・4 軸・日付だけ。壊れた値は読まない", () => {
    saveAgain(rec("p1", "n1"));
    const saved = JSON.parse(store.get("takoshin:again")!) as object[];
    expect(Object.keys(saved[0]).sort()).toEqual([
      "axes",
      "date",
      "newSurveyId",
      "prevSurveyId",
      "type",
    ]);
    store.set(
      "takoshin:again",
      JSON.stringify([{ prevSurveyId: "x" }, rec("p1", "n1"), 3]),
    );
    expect(againRecords()).toHaveLength(1);
    store.set("takoshin:again", "{");
    expect(againRecords()).toEqual([]);
  });
  it("診断を消すと、その診断が前回・今回のどちらでも消える", () => {
    saveAgain(rec("p1", "n1"));
    saveAgain(rec("n1", "n2"));
    saveAgain(rec("q1", "q2"));
    forgetAgainOf("n1");
    expect(againRecords().map((r) => r.newSurveyId)).toEqual(["q2"]);
  });
});

describe("サーバー：結果が出た日と入口", () => {
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

  it("入口 again を受け付ける", () => {
    expect(isEntry("again")).toBe(true);
  });

  it("結果が出た日を、管理の画面と「つくった診断」の状態に返す。出る前は null", async () => {
    const t0 = new Date("2026-07-31T03:00:00Z");
    const r = await createSurvey({ nickname: "たろう", targetCount: 3 }, t0, {
      origin: "none",
      campaign: null,
      entry: "again",
      test: false,
    });
    if (!r.ok) throw new Error(r.error);
    expect((await getHostSummary(r.hostKey, t0))?.completedAt).toBeNull();
    expect((await getHost(r.hostKey, t0))?.completedAt).toBeNull();
    for (const k of ["a", "b", "c"])
      await submitResponse(
        r.surveyId,
        { answers: Array(QUESTIONS.length).fill(2) },
        k,
        t0,
      );
    const later = new Date(t0.getTime() + DAY);
    expect((await getHostSummary(r.hostKey, later))?.completedAt).toBe(
      t0.toISOString(),
    );
    expect((await getHost(r.hostKey, later))?.completedAt).toBe(
      t0.toISOString(),
    );
    const { rows } = await db.query<{ entry: string }>(
      `select entry from survey_stats`,
    );
    expect(rows.map((x) => x.entry)).toEqual(["again"]);
  });
});
