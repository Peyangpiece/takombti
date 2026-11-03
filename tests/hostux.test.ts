// 作る人の画面の小さな決まり（仕様書 §4.2・§4.6・§4.16）
import { beforeAll, describe, expect, it } from "vitest";
import { groupLabel, surveyHref } from "../src/app/MySurveys";
import { daysLeft, EXTEND_SOON_DAYS } from "../src/app/h/StatusPage";
import { groupTimeNote } from "../src/app/g/[groupId]/GroupPage";
import { GROUPS_KEY, saveGroup, savedGroups } from "../src/lib/client";

describe("つくった診断の一覧から開く先（§4.2）", () => {
  it("結果が出た診断は、結果の画面へ直接", () => {
    expect(
      surveyHref(
        { status: "completed", targetCount: 3, responseCount: 3 },
        "KEY",
      ),
    ).toBe("/h/result#KEY");
  });
  it("受付中・期限切れ・まだ分からない・見つからないときは、回答状況の画面", () => {
    expect(
      surveyHref({ status: "open", targetCount: 3, responseCount: 1 }, "KEY"),
    ).toBe("/h#KEY");
    expect(
      surveyHref({ status: "expired", targetCount: 3, responseCount: 1 }, "K"),
    ).toBe("/h#K");
    expect(surveyHref(undefined, "K")).toBe("/h#K");
    expect(surveyHref("gone", "K")).toBe("/h#K");
  });
});

describe("受付の期限ののこり（§4.6）", () => {
  // 端末の時刻で数えるので、テストも端末の時刻で日時を作る
  const at = (m: number, d: number, h: number, min = 0) =>
    new Date(2026, m - 1, d, h, min).toISOString();
  const now = new Date(2026, 10, 28, 9, 5).getTime();
  it("画面に出す期限の日付までの日数を、暦の日付で数える", () => {
    // 期限が 5 日後の朝 9:03 でも、いまの 9:05 より前でも、「あと 5 日」
    expect(daysLeft(at(12, 3, 9, 3), now)).toBe(5);
    expect(daysLeft(at(12, 3, 23, 59), now)).toBe(5);
    expect(daysLeft(at(12, 28, 9), now)).toBe(30);
    expect(daysLeft(at(11, 28, 23), now)).toBe(0);
    expect(daysLeft(at(11, 27, 23), now)).toBe(-1);
  });
  it("のばすボタンを目立たせるのは、のこり 7 日以下から", () => {
    expect(EXTEND_SOON_DAYS).toBe(7);
  });
});

describe("参加したグループの名前（§4.16）", () => {
  it("作った人の呼び名があれば「〇〇のグループ」", () => {
    expect(
      groupLabel({
        groupId: "g",
        hostKey: "h",
        nickname: "はな",
        creator: "たろう",
        createdAt: "",
      }),
    ).toEqual({ title: "たろうのグループ", note: "はなで参加" });
  });
  it("自分で作ったグループは「あなたが作成」", () => {
    expect(
      groupLabel({
        groupId: "g",
        hostKey: "h",
        adminKey: "a",
        nickname: "たろう",
        creator: "たろう",
        createdAt: "",
      }),
    ).toEqual({ title: "たろうのグループ", note: "あなたが作成" });
  });
  it("前の版で覚えた（作った人の呼び名がない）ものも、そのまま出せる", () => {
    expect(
      groupLabel({
        groupId: "g",
        hostKey: "h",
        nickname: "はな",
        createdAt: "",
      }),
    ).toEqual({ title: "グループ", note: "はなで参加" });
  });
});

describe("グループで答える時間の目安（§4.16）", () => {
  it("人数分の時間と、続きから答えられることを書く", () => {
    const t = groupTimeNote(3);
    expect(t).toContain("3 人分で約 9〜18 分");
    expect(t).toContain("続きから答えられます");
  });
  it("1 人だけなら、人数分の時間は書かない", () => {
    expect(groupTimeNote(1)).not.toContain("人分");
  });
});

describe("端末に覚える参加したグループ（§4.16）", () => {
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
  it("作った人の呼び名は、あとから呼び名なしで覚え直しても消さない", () => {
    store.delete(GROUPS_KEY);
    saveGroup({
      groupId: "g1",
      hostKey: "h1",
      nickname: "はな",
      creator: "たろう",
      createdAt: "2026-01-01",
    });
    saveGroup({
      groupId: "g1",
      hostKey: "h2",
      nickname: "はな",
      createdAt: "2026-02-01",
    });
    const [g] = savedGroups();
    expect(g.creator).toBe("たろう");
    expect(g.hostKey).toBe("h2");
    expect(g.createdAt).toBe("2026-01-01");
  });
  it("前の版で覚えたもの（作った人の呼び名なし）に、あとから足せる", () => {
    store.set(
      GROUPS_KEY,
      JSON.stringify([
        { groupId: "g2", hostKey: "h", nickname: "はな", createdAt: "x" },
      ]),
    );
    saveGroup({
      groupId: "g2",
      hostKey: "h",
      nickname: "はな",
      creator: "じろう",
      createdAt: "y",
    });
    expect(savedGroups()[0].creator).toBe("じろう");
  });
});
