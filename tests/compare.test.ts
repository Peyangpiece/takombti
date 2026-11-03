// 2 人の結果を並べる（仕様書 §4.15）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  axisCloseness,
  compareTarget,
  leanFill,
  leanPosition,
  matchBetween,
  shareIdFrom,
  type AxisPoint,
} from "../src/lib/compare";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  createSurvey,
  getSharedPair,
  setShare,
  submitResponse,
} from "../src/lib/surveys";
import { QUESTIONS } from "../src/data/questions";
import { renderToStaticMarkup } from "react-dom/server";
import ComparePage from "../src/app/r/[shareId]/vs/[otherId]/page";
import { Meters } from "../src/components/Meters";
import { createElement } from "react";

const ID = "AbCdEfGhIjKlMnOpQrStUv";
const ID2 = "zyxwvutsrqponmlkjihgf_";

describe("貼り付けた値から公開カードの ID を取り出す", () => {
  it("URL・相対パス・ID だけを受け付ける", () => {
    expect(shareIdFrom(ID)).toBe(ID);
    expect(shareIdFrom(` https://takoshin.example/r/${ID}?from=copy `)).toBe(
      ID,
    );
    expect(shareIdFrom(`https://takoshin.example/r/${ID}#x`)).toBe(ID);
    expect(shareIdFrom(`/r/${ID}`)).toBe(ID);
    // 並べたページのリンクなら 1 人目
    expect(shareIdFrom(`https://t.example/r/${ID}/vs/${ID2}`)).toBe(ID);
  });
  it("形がちがえば null", () => {
    expect(shareIdFrom("")).toBeNull();
    expect(shareIdFrom("short")).toBeNull();
    expect(shareIdFrom(`https://t.example/a/${ID}`)).toBeNull();
    expect(shareIdFrom(`https://t.example/h#${ID}`)).toBeNull();
    expect(shareIdFrom(`https://t.example/r/${ID}<script>`)).toBeNull();
    expect(shareIdFrom(`https://t.example/r/${"a".repeat(65)}`)).toBeNull();
  });
  it("自分のカードとは並べない", () => {
    expect(compareTarget(ID, `/r/${ID}`)).toEqual({ ok: false, error: "self" });
    expect(compareTarget(ID, "xx")).toEqual({ ok: false, error: "format" });
    expect(compareTarget(ID, ID2)).toEqual({
      ok: true,
      path: `/r/${ID}/vs/${ID2}`,
    });
  });
});

const p = (pole: AxisPoint["pole"], percent: number, tie = false) => ({
  axis: "A1",
  pole,
  percent,
  tie,
});

describe("帯の上の位置と塗り（§4.15・§7.3）", () => {
  it("塗りは、選ばれた極の側の端から割合のぶんだけ", () => {
    // 外向（左の極）72% は左端から 72%、内向（右の極）72% は右端から 72%
    expect(leanFill(p("E", 72))).toEqual({ left: 0, width: 72 });
    expect(leanFill(p("I", 72))).toEqual({ left: 28, width: 72 });
    expect(leanFill(p("E", 100))).toEqual({ left: 0, width: 100 });
    expect(leanFill(p("E", 50, true))).toEqual({ left: 50, width: 0 });
  });
  it("つまみは塗りの先", () => {
    expect(leanPosition(p("E", 72))).toBe(72);
    expect(leanPosition(p("I", 72))).toBe(28);
    expect(leanPosition(p("I", 50, true))).toBe(50);
  });
});

describe("結果の 4 軸メーター（§7.3）", () => {
  const ax = (
    axis: string,
    pole: AxisPoint["pole"],
    percent: number,
    tie = false,
  ) => ({
    axis: axis as "A1",
    pole,
    percent,
    tie,
    strength: "やや" as const,
    agreement: "多数派" as const,
  });
  const html = renderToStaticMarkup(
    createElement(Meters, {
      axes: [
        ax("A1", "E", 72),
        ax("A2", "N", 52),
        ax("A3", "T", 50, true),
        ax("A4", "P", 80),
      ],
    }),
  );
  it("選ばれた極の側の端から割合のぶんだけ塗り、つまみをその先に置く", () => {
    // 外向 72%：左端から 72%。柔軟（右の極）80%：右端から 80%
    expect(html).toContain('style="left:0%;width:72%"');
    expect(html).toContain('class="knob" style="left:72%"');
    expect(html).toContain('style="left:20%;width:80%"');
  });
  it("ど真ん中の軸は、どちらの極も勝ち色にせず、塗らず、真ん中に「どちらとも（50%）」", () => {
    expect(html).toContain("どちらとも（50%）");
    // 塗りは 3 本（ど真ん中の軸は塗らない）、勝ち色の極も 3 つ
    expect(html.match(/class="fill"/g)).toHaveLength(3);
    expect(html.match(/class="win"/g)).toHaveLength(3);
  });
  it("ほぼ半々（55% 未満）の軸には「ほぼ半々」と添える", () => {
    expect(html.match(/ほぼ半々</g)).toHaveLength(1);
  });
});

describe("軸の近さ", () => {
  it("同じ側で 20 ポイント未満なら近い、以上なら寄り方がちがう", () => {
    expect(axisCloseness(p("E", 72), p("E", 61)).kind).toBe("close");
    expect(axisCloseness(p("E", 90), p("E", 60))).toEqual({
      kind: "same_side",
      gap: 30,
    });
  });
  it("反対の側で 20 ポイント以上なら反対、未満なら差は小さい", () => {
    expect(axisCloseness(p("E", 70), p("I", 65))).toEqual({
      kind: "opposite",
      gap: 35,
    });
    expect(axisCloseness(p("E", 55), p("I", 56)).kind).toBe("near");
  });
  it("ど真ん中は、どちらの側にも数えない", () => {
    expect(axisCloseness(p("I", 50, true), p("E", 60)).kind).toBe("near");
    expect(axisCloseness(p("I", 50, true), p("E", 80)).kind).toBe("apart");
    expect(axisCloseness(p("I", 50, true), p("E", 50, true)).kind).toBe("near");
  });
});

describe("相性（おまけ）", () => {
  it("どちらかが挙げていれば出す。関係は両方向で同じ", () => {
    expect(matchBetween("ESFP", "ISFJ")).toBe("easy");
    expect(matchBetween("ISFJ", "ESFP")).toBe("easy");
    expect(matchBetween("ESFP", "ISTJ")).toBe("spark");
    expect(matchBetween("ISTJ", "ESFP")).toBe("spark");
    expect(matchBetween("ESFP", "ESFP")).toBe("same");
    expect(matchBetween("ESFP", "INTJ")).toBeNull();
  });
});

describe("公開カードどうしを読む", () => {
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

  async function published(nickname: string, v: number) {
    const r = await createSurvey({ nickname, targetCount: 3 });
    if (!r.ok) throw new Error(r.error);
    for (const k of ["a", "b", "c"])
      await submitResponse(
        r.surveyId,
        { answers: Array(QUESTIONS.length).fill(v) },
        `${nickname}${k}`,
      );
    const s = await setShare(r.hostKey, true);
    return { hostKey: r.hostKey, shareId: s.shareId! };
  }

  it("どちらも公開中のときだけ、公開カードと同じ中身を返す", async () => {
    const a = await published("たろう", 1);
    const b = await published("はな", 7);
    const pair = await getSharedPair(a.shareId, b.shareId);
    expect(pair?.map((v) => v.nickname)).toEqual(["たろう", "はな"]);
    expect(Object.keys(pair![0]).sort()).toEqual([
      "axes",
      "n",
      "nickname",
      "type",
    ]);
    // 同じカードどうし・形がちがう ID は断る
    expect(await getSharedPair(a.shareId, a.shareId)).toBeNull();
    expect(await getSharedPair(a.shareId, "bad id")).toBeNull();
    // 並べたページ：2 人の呼び名・4 つの軸の近さの言葉を出す
    const html = renderToStaticMarkup(
      await ComparePage({
        params: Promise.resolve({ shareId: a.shareId, otherId: b.shareId }),
      }),
    );
    expect(html).toContain("たろう と はな、並べてみると");
    expect(html.match(/class="cmp-close /g)).toHaveLength(4);
    // どの帯も、真ん中から寄っている側へ塗る（つまみだけだと反対の側に見えるため）
    const knobs = [...html.matchAll(/class="knob" style="left:([\d.]+)%"/g)];
    expect(knobs).toHaveLength(8);
    const fills = html.match(/class="fill"/g) ?? [];
    expect(fills.length).toBe(
      pair!.flatMap((v) => v.axes).filter((x) => !x.tie).length,
    );
    // つまみは、寄っている極の側（leanPosition）に置く
    const expected = [0, 1, 2, 3].flatMap((i) =>
      pair!.map((v) => leanPosition(v.axes[i])),
    );
    expect(knobs.map((m) => Number(m[1]))).toEqual(expected);
    expect(html).toContain('href="/new?entry=public"');
    // 片方が公開をやめたら並べられない
    await setShare(b.hostKey, false);
    expect(await getSharedPair(a.shareId, b.shareId)).toBeNull();
  });
});
