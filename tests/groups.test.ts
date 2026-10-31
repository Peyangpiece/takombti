// グループ診断（仕様書 §4.15・§5.5・§8.5）：作る・参加・始める・答える・片付け
// DATABASE_URL があれば本物の PostgreSQL、なければ PGlite で動かす。
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  cleanupGroups,
  createGroup,
  getGroup,
  joinGroup,
  startGroup,
} from "../src/lib/groups";
import {
  deleteSurvey,
  getHost,
  hashKey,
  submitResponse,
} from "../src/lib/surveys";
import { summarizeFunnel } from "../src/lib/funnel";
import { QUESTIONS } from "../src/data/questions";
import { GET as groupView } from "../src/app/api/groups/[groupId]/route";
import { POST as joinRoute } from "../src/app/api/groups/[groupId]/join/route";
import { POST as startRoute } from "../src/app/api/groups/[groupId]/start/route";
import { POST as respond } from "../src/app/api/surveys/[surveyId]/responses/route";
import { GET as publicView } from "../src/app/api/surveys/[surveyId]/public/route";
import { GET as hostView } from "../src/app/api/host/route";

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
  await db.exec(
    "delete from group_members; delete from survey_groups; delete from responses; delete from surveys; delete from funnel_counts; delete from survey_stats; delete from rate_limits;",
  );
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) await db.close();
});

const DAY = 24 * 60 * 60 * 1000;
const answers = Array(QUESTIONS.length).fill(6);

async function make(size = 4, now = new Date()) {
  const g = await createGroup({ nickname: "たろう", size }, now);
  if (!g.ok) throw new Error(g.error);
  return g;
}

async function join(groupId: string, nickname: string, now = new Date()) {
  const r = await joinGroup(groupId, { nickname }, now);
  if (r.status !== "ok") throw new Error(r.status);
  return r;
}

const ctx = <T extends string>(key: T, id: string) => ({
  params: Promise.resolve({ [key]: id } as Record<T, string>),
});

function cookieOf(res: Response, name: string): string | null {
  const hit = res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${name}=`) && !c.includes("Max-Age=0"));
  return hit ? hit.split(";")[0].slice(name.length + 1) : null;
}

describe("作る", () => {
  it("呼び名と人数（4〜8 人）を確かめる", async () => {
    expect(await createGroup({ nickname: "", size: 5 })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(await createGroup({ nickname: "しね", size: 5 })).toEqual({
      ok: false,
      error: "ng_word",
    });
    for (const size of [3, 9, 4.5, "x", null])
      expect(await createGroup({ nickname: "たろう", size })).toEqual({
        ok: false,
        error: "bad_size",
      });
    const g = await make(8);
    expect(g.hostKey).not.toBe(g.adminKey);
    const view = await getGroup(g.groupId, g.hostKey, g.adminKey);
    expect(view).toMatchObject({
      status: "joining",
      size: 8,
      joined: 1,
      creator: "たろう",
      member: true,
      admin: true,
    });
    // 鍵はハッシュ値だけを持つ
    const { rows } = await db.query<{ host_key_hash: string }>(
      `select host_key_hash from group_members where group_id = $1`,
      [g.groupId],
    );
    expect(rows[0].host_key_hash).toBe(hashKey(g.hostKey));
  });
});

describe("参加", () => {
  it("呼び名を確かめ、同じグループの同じ呼び名は断る", async () => {
    const g = await make(6);
    expect(await joinGroup(g.groupId, { nickname: "" })).toEqual({
      status: "empty",
    });
    expect(await joinGroup(g.groupId, { nickname: "ばか" })).toEqual({
      status: "ng_word",
    });
    expect(await joinGroup(g.groupId, { nickname: "たろう" })).toEqual({
      status: "duplicate_name",
    });
    await join(g.groupId, "Hana");
    // 全角・大文字小文字のちがいも同じ呼び名とみなす
    expect(await joinGroup(g.groupId, { nickname: "ｈａｎａ" })).toEqual({
      status: "duplicate_name",
    });
    expect(await joinGroup("x".repeat(22), { nickname: "じろう" })).toEqual({
      status: "not_found",
    });
  });

  it("決めた人数がそろったら、その場で始まり、それより後は参加できない", async () => {
    const g = await make(4);
    const b = await join(g.groupId, "はなこ");
    const c = await join(g.groupId, "じろう");
    expect(b.surveyId).toBeNull();
    expect((await getGroup(g.groupId, null))!.status).toBe("joining");
    const d = await join(g.groupId, "さぶろう");
    expect(d.surveyId).toBeTruthy();
    expect((await getGroup(g.groupId, null))!.status).toBe("started");
    expect(await joinGroup(g.groupId, { nickname: "しろう" })).toEqual({
      status: "closed",
    });
    // 1 人に 1 つずつ、人数 J−1 の診断ができ、管理用の鍵はそのメンバーの鍵
    for (const [key, name] of [
      [g.hostKey, "たろう"],
      [b.hostKey, "はなこ"],
      [c.hostKey, "じろう"],
      [d.hostKey, "さぶろう"],
    ]) {
      const h = await getHost(key);
      expect(h).toMatchObject({
        nickname: name,
        targetCount: 3,
        responseCount: 0,
        status: "open",
        groupId: g.groupId,
      });
    }
    expect((await getHost(d.hostKey))!.surveyId).toBe(d.surveyId);
    // 計測：診断ごとの記録は入口「グループで一斉に」
    const { rows } = await db.query<{ entry: string }>(
      `select st.entry from surveys s join survey_stats st on st.id = s.stats_id
        where s.group_id = $1`,
      [g.groupId],
    );
    expect(rows.map((r) => r.entry)).toEqual(Array(4).fill("group"));
  });

  it("同時に参加しても、人数をこえない", async () => {
    const g = await make(5);
    const names = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];
    const out = await Promise.all(
      names.map((n) => joinGroup(g.groupId, { nickname: n })),
    );
    expect(out.filter((r) => r.status === "ok")).toHaveLength(4);
    const { rows } = await db.query(
      `select 1 from surveys where group_id = $1`,
      [g.groupId],
    );
    expect(rows).toHaveLength(5);
  });

  it("期限を過ぎたグループには参加できない", async () => {
    const t0 = new Date("2026-11-01T00:00:00Z");
    const g = await make(4, t0);
    expect(
      await joinGroup(
        g.groupId,
        { nickname: "はなこ" },
        new Date(t0.getTime() + 31 * DAY),
      ),
    ).toEqual({ status: "expired" });
  });
});

describe("締め切って始める", () => {
  it("作った人の鍵で、4 人以上のときだけ始められる", async () => {
    const g = await make(8);
    const b = await join(g.groupId, "はなこ");
    await join(g.groupId, "じろう");
    expect(await startGroup(g.groupId, g.adminKey)).toEqual({
      status: "not_enough",
    });
    await join(g.groupId, "さぶろう");
    // 作った人の鍵でなければ断る（メンバーの管理用の鍵でも）
    expect(await startGroup(g.groupId, b.hostKey)).toEqual({
      status: "forbidden",
    });
    expect((await getGroup(g.groupId, null))!.status).toBe("joining");
    const r = await startGroup(g.groupId, g.adminKey, g.hostKey);
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.surveyId).toBe(
      (await getHost(g.hostKey))!.surveyId,
    );
    expect((await getHost(b.hostKey))!.targetCount).toBe(3);
    expect(await startGroup(g.groupId, g.adminKey)).toEqual({
      status: "closed",
    });
  });

  it("API は X-Admin-Key がなければ断る", async () => {
    const g = await make(4);
    const post = (headers: Record<string, string>) =>
      startRoute(
        new NextRequest(`https://x.test/api/groups/${g.groupId}/start`, {
          method: "POST",
          headers,
        }),
        ctx("groupId", g.groupId),
      );
    expect((await post({})).status).toBe(403);
    expect((await post({ "x-admin-key": g.hostKey })).status).toBe(403);
    expect((await post({ "x-admin-key": g.adminKey })).status).toBe(409);
  });
});

describe("グループのページ", () => {
  async function started() {
    const g = await make(4);
    const b = await join(g.groupId, "はなこ");
    const c = await join(g.groupId, "じろう");
    const d = await join(g.groupId, "さぶろう");
    return { g, keys: [g.hostKey, b.hostKey, c.hostKey, d.hostKey] };
  }

  it("メンバーでない人には、呼び名の一覧も診断の ID も返さない", async () => {
    const { g } = await started();
    const view = await getGroup(g.groupId, null);
    expect(view).toEqual({
      status: "started",
      size: 4,
      joined: 4,
      creator: "たろう",
      member: false,
      admin: false,
      members: null,
      mine: null,
    });
  });

  it("メンバーには、ほかの人の答える先だけを返し、鍵やほかの人の進み具合は返さない", async () => {
    const { g, keys } = await started();
    const before = await getGroup(g.groupId, keys[0]);
    const other = before!.members!.find((m) => m.nickname === "はなこ")!;
    expect(other.surveyId).toBeTruthy();
    // ほかの人の診断に答えても、ほかのメンバーの見る内容は変わらない（自分の診断の状態だけ）
    await submitResponse(other.surveyId!, { answers }, "rk-1");
    const after = await getGroup(g.groupId, keys[0]);
    expect(after).toEqual(before);
    const json = JSON.stringify(after);
    for (const k of keys) {
      expect(json).not.toContain(k);
      expect(json).not.toContain(hashKey(k));
    }
    expect(json).not.toMatch(/response|answered|count/i);
    expect(after!.mine).toMatchObject({
      nickname: "たろう",
      status: "open",
      remaining: 3,
    });
    // はなこには、自分の診断のあと何人かが見える
    expect((await getGroup(g.groupId, keys[1]))!.mine!.remaining).toBe(2);
  });

  it("自分の診断には答えられない（ページを開いた端末にホストの印を付ける）", async () => {
    const { g, keys } = await started();
    const res = await groupView(
      new NextRequest(`https://x.test/api/groups/${g.groupId}`, {
        headers: { "x-host-key": keys[1] },
      }),
      ctx("groupId", g.groupId),
    );
    const body = (await res.json()) as { mine: { surveyId: string } };
    const own = body.mine.surveyId;
    const mark = cookieOf(res, `tkh_${own}`);
    expect(mark).toBe("1");
    // 印はその診断の API にだけ送る
    expect(
      res.headers
        .getSetCookie()
        .some(
          (c) =>
            c.startsWith(`tkh_${own}=1`) && c.includes(`/api/surveys/${own}`),
        ),
    ).toBe(true);
    const pub = await publicView(
      new NextRequest(`https://x.test/api/surveys/${own}/public`, {
        headers: { cookie: `tkh_${own}=1` },
      }),
      ctx("surveyId", own),
    );
    expect(((await pub.json()) as { isHost: boolean }).isHost).toBe(true);
    const sent = await respond(
      new NextRequest(`https://x.test/api/surveys/${own}/responses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "192.0.2.50",
          cookie: `tkh_${own}=1`,
        },
        body: JSON.stringify({ answers }),
      }),
      ctx("surveyId", own),
    );
    expect(sent.status).toBe(403);
    // 管理の画面（/api/host）を開いた端末にも付ける
    const h = await hostView(
      new NextRequest(`https://x.test/api/host`, {
        headers: { "x-host-key": keys[1] },
      }),
    );
    expect(cookieOf(h, `tkh_${own}`)).toBe("1");
  });

  it("参加でそろって始まったとき、参加した端末にホストの印を付ける", async () => {
    const g = await make(4);
    await join(g.groupId, "はなこ");
    await join(g.groupId, "じろう");
    const res = await joinRoute(
      new NextRequest(`https://x.test/api/groups/${g.groupId}/join`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "192.0.2.60",
        },
        body: JSON.stringify({ nickname: "さぶろう" }),
      }),
      ctx("groupId", g.groupId),
    );
    expect(res.status).toBe(201);
    const { hostKey } = (await res.json()) as { hostKey: string };
    const own = (await getHost(hostKey))!.surveyId;
    expect(cookieOf(res, `tkh_${own}`)).toBe("1");
  });

  it("参加の API は、同じ回線から 1 時間に 20 件まで", async () => {
    const g = await make(8);
    const post = (nickname: string) =>
      joinRoute(
        new NextRequest(`https://x.test/api/groups/${g.groupId}/join`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": "192.0.2.70",
          },
          body: JSON.stringify({ nickname }),
        }),
        ctx("groupId", g.groupId),
      );
    for (let i = 0; i < 20; i++) expect((await post("")).status).toBe(400);
    expect((await post("はなこ")).status).toBe(429);
  });

  it("診断を消しても、グループのページは壊れない", async () => {
    const { g, keys } = await started();
    expect(await deleteSurvey(keys[1])).toBe("ok");
    const mine = await getGroup(g.groupId, keys[1]);
    expect(mine!.mine).toMatchObject({ status: "deleted", surveyId: null });
    const other = await getGroup(g.groupId, keys[0]);
    expect(
      other!.members!.find((m) => m.nickname === "はなこ")!.surveyId,
    ).toBeNull();
    expect(other!.mine!.status).toBe("open");
  });
});

describe("片付け", () => {
  it("集まりきらないまま期限が来たら期限切れにし、30 日で消す", async () => {
    const t0 = new Date("2026-11-01T00:00:00Z");
    const g = await make(5, t0);
    await join(g.groupId, "はなこ", t0);
    await cleanupGroups(new Date(t0.getTime() + 10 * DAY));
    expect((await getGroup(g.groupId, null, null, t0))!.status).toBe("joining");
    const t1 = new Date(t0.getTime() + 31 * DAY);
    expect(await cleanupGroups(t1)).toEqual({ expired: 1, deleted: 0 });
    expect((await getGroup(g.groupId, null, null, t1))!.status).toBe("expired");
    expect(await cleanupGroups(new Date(t1.getTime() + 31 * DAY))).toEqual({
      expired: 0,
      deleted: 1,
    });
    expect(await getGroup(g.groupId, null)).toBeNull();
    const { rows } = await db.query(
      `select 1 from group_members where group_id = $1`,
      [g.groupId],
    );
    expect(rows).toHaveLength(0);
  });

  it("始めたグループは、メンバーの診断がすべて消えたら消す", async () => {
    const g = await make(4);
    const keys = [g.hostKey];
    for (const n of ["はなこ", "じろう", "さぶろう"])
      keys.push((await join(g.groupId, n)).hostKey);
    for (const k of keys.slice(0, 3)) await deleteSurvey(k);
    expect((await cleanupGroups()).deleted).toBe(0);
    await deleteSurvey(keys[3]);
    expect((await cleanupGroups()).deleted).toBe(1);
    expect(await getGroup(g.groupId, null)).toBeNull();
  });
});

describe("計測", () => {
  it("グループの作成・参加・開始を数える", async () => {
    const g = await make(4);
    for (const n of ["はなこ", "じろう", "さぶろう"]) await join(g.groupId, n);
    const s = await summarizeFunnel();
    expect(s.byKey.group).toEqual({ created: 1, joined: 3, started: 1 });
    expect(s.byEntry.find((e) => e.id === "group")?.created).toBe(4);
  });
});
