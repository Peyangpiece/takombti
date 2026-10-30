// 安全とプライバシーの強化（仕様書 §8.4・§8.6）：回数の記録の鍵付きハッシュ・本文の読み方・
// 書き込みの入口・運営者の入り方・定時処理の合言葉・呼び名の似た形の文字
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import { guardRequest } from "../src/lib/guard";
import {
  BODY_MAX_BYTES,
  RATE_LIMIT,
  keyOf,
  readJson,
  readTextLimited,
} from "../src/lib/http";
import { checkNickname, containsNgWord } from "../src/lib/text";
import { SESSION_COOKIE, createSession, isSession } from "../src/lib/passkeys";
import { POST as stripeWebhook } from "../src/app/api/stripe/webhook/route";
import { POST as tokenLogin } from "../src/app/api/admin/login/token/route";
import { POST as logoutAll } from "../src/app/api/admin/logout/all/route";
import { POST as registerOptions } from "../src/app/api/admin/passkeys/register/options/route";
import { POST as registerRoute } from "../src/app/api/admin/passkeys/register/route";
import { DELETE as deletePasskeyRoute } from "../src/app/api/admin/passkeys/[id]/route";
import { GET as cronCleanup } from "../src/app/api/cron/cleanup/route";

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
afterAll(async () => {
  if (!process.env.DATABASE_URL) await db.close();
});

function restoreEnv(name: string, prev: string | undefined) {
  if (prev === undefined) delete process.env[name];
  else process.env[name] = prev;
}

describe("回数の記録の名前（鍵付きのハッシュ値）", () => {
  it("鍵のないハッシュ値ではなく、サーバーの鍵による HMAC にする（IP を総当たりで割り出せない）", () => {
    const prev = process.env.RATE_LIMIT_SECRET;
    try {
      process.env.RATE_LIMIT_SECRET = "a".repeat(40);
      const k1 = keyOf("203.0.113.5", "respond:x");
      const plain = createHash("sha256")
        .update("203.0.113.5|respond:x")
        .digest("hex");
      expect(k1).toMatch(/^[0-9a-f]{64}$/);
      expect(k1).not.toBe(plain);
      // 同じ鍵なら同じ名前（数えられる）、鍵がちがえば別の名前
      expect(keyOf("203.0.113.5", "respond:x")).toBe(k1);
      process.env.RATE_LIMIT_SECRET = "b".repeat(40);
      expect(keyOf("203.0.113.5", "respond:x")).not.toBe(k1);
    } finally {
      restoreEnv("RATE_LIMIT_SECRET", prev);
    }
  });
});

// Content-Length を付けずに、少しずつ送る本文
function streamed(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const s of chunks) c.enqueue(enc.encode(s));
      c.close();
    },
  });
}

function postReq(
  body: BodyInit | null,
  headers: Record<string, string> = { "content-type": "application/json" },
  url = "https://takoshin.example/api/x",
) {
  return new NextRequest(url, {
    method: "POST",
    headers,
    body,
    // ReadableStream を本文にするときに要る
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
}

const kb = (n: number) => Array<string>(n).fill("x".repeat(1024));

describe("本文の読み方", () => {
  it("Content-Length がなくても、読んだバイト数で上限を確かめる", async () => {
    expect(
      await readTextLimited(postReq(streamed(kb(20))), BODY_MAX_BYTES),
    ).toBeNull();
    expect(await readJson(postReq(streamed(kb(20))))).toBeNull();
    expect(await readTextLimited(postReq(streamed(["ab", "cd"])), 4)).toBe(
      "abcd",
    );
    // 文字数ではなくバイト数で数える（「あ」は 3 バイト）
    expect(
      await readTextLimited(postReq(streamed(["あ", "い"])), 5),
    ).toBeNull();
    expect(await readTextLimited(postReq(streamed(["あ", "い"])), 6)).toBe(
      "あい",
    );
  });

  it("宣言された Content-Length が上限をこえれば読まずに断る", async () => {
    const r = postReq("{}", {
      "content-type": "application/json",
      "content-length": String(BODY_MAX_BYTES + 1),
    });
    expect(await readTextLimited(r, BODY_MAX_BYTES)).toBeNull();
  });

  it("JSON と名乗らない本文は読まない", async () => {
    expect(await readJson(postReq('{"a":1}'))).toEqual({ a: 1 });
    expect(
      await readJson(
        postReq('{"a":1}', {
          "content-type": "application/json; charset=utf-8",
        }),
      ),
    ).toEqual({ a: 1 });
    expect(
      await readJson(postReq('{"a":1}', { "content-type": "text/plain" })),
    ).toBeNull();
    expect(await readJson(postReq('{"a":1}', {}))).toBeNull();
  });

  it("Stripe からの知らせは 64KB をこえると、署名を確かめる前に 413 で断る", async () => {
    const url = "https://takoshin.example/api/stripe/webhook";
    const sig = { "stripe-signature": "t=1,v1=x" };
    expect(
      (await stripeWebhook(postReq(streamed(kb(70)), sig, url))).status,
    ).toBe(413);
    // 小さな本文は、いつもどおり署名を確かめる（まちがっているので 400）
    expect((await stripeWebhook(postReq("{}", sig, url))).status).toBe(400);
  });
});

describe("書き込みの API の入口（よそのサイトと本文の形）", () => {
  const send = (
    headers: Record<string, string>,
    body?: string,
    path = "/api/surveys",
  ) =>
    guardRequest(
      new Request(`https://takoshin.example${path}`, {
        method: "POST",
        headers,
        body,
      }),
    );
  const json = { "content-type": "application/json" };

  it("Sec-Fetch-Site は same-origin と none だけを通す", () => {
    expect(send({ ...json, "sec-fetch-site": "same-site" }, "{}")?.status).toBe(
      403,
    );
    expect(
      send({ ...json, "sec-fetch-site": "cross-site" }, "{}")?.status,
    ).toBe(403);
    expect(send({ ...json, "sec-fetch-site": "none" }, "{}")).toBeNull();
    expect(send({ ...json, "sec-fetch-site": "same-origin" }, "{}")).toBeNull();
  });

  it("本文のある書き込みは application/json だけ。フォームや text/plain は 415", () => {
    expect(send({ "content-type": "text/plain" }, "{}")?.status).toBe(415);
    expect(
      send({ "content-type": "application/x-www-form-urlencoded" }, "a=1")
        ?.status,
    ).toBe(415);
    expect(
      send({ "content-type": "multipart/form-data; boundary=x" })?.status,
    ).toBe(415);
    // 形を名乗らない本文も断る
    expect(send({}, "{}")?.status).toBe(415);
    expect(send(json, "{}")).toBeNull();
    expect(
      send({ "content-type": "Application/JSON; charset=utf-8" }, "{}"),
    ).toBeNull();
    // 本文のない書き込み（出る・消すなど）は、形を名乗らなくてよい
    expect(send({})).toBeNull();
    // Stripe からの知らせは除く
    expect(
      send({ "content-type": "text/plain" }, "{}", "/api/stripe/webhook"),
    ).toBeNull();
  });
});

describe("呼び名の禁止語（似た形の文字）", () => {
  it("キリル文字・小さな大文字・記号付きの英字に替えてもすり抜けない", () => {
    for (const n of [
      "fuсk", // с（キリル文字）
      "shіt", // і（キリル文字）
      "ꜱhit", // ꜱ（小さな大文字）
      "ѕhit", // ѕ（キリル文字）
      "bitcһ", // һ（キリル文字）
      "fück", // ü
      "ＦＵＣＫ",
    ])
      expect(containsNgWord(n), n).toBe(true);
  });

  it("かなの言葉のあいだに英字を入れてもすり抜けない", () => {
    for (const n of ["しxね", "ちnこ", "まaんこ", "Taroしxね", "ばxか"])
      expect(containsNgWord(n), n).toBe(true);
    expect(checkNickname("しxね").error).toBe("ng_word");
    expect(checkNickname("ちnこ").error).toBe("ng_word");
  });

  it("ふつうの名前と、前から止めないことにしている言葉は止めない", () => {
    for (const n of [
      "さくら",
      "Taro",
      "ゆうき",
      "yoshitaka",
      "toshitaka",
      "Sakuraちゃん",
      "Иван",
      "Αλέξης",
      "José",
      "ほしねえ",
      "シンデレラ",
      "ころすけ",
      "かすみ",
      "ちびまる",
      "Nanaしんでれら",
    ])
      expect(containsNgWord(n), n).toBe(false);
    expect(checkNickname("さくら").error).toBeNull();
    expect(checkNickname("Taro").error).toBeNull();
  });
});

describe("運営者の入り方（§8.6）", () => {
  const SECRET = "t".repeat(40);
  const WRONG = "w".repeat(40);
  let prev: string | undefined;
  beforeAll(() => {
    prev = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = SECRET;
  });
  afterAll(() => restoreEnv("ADMIN_TOKEN", prev));

  const adminReq = (
    path: string,
    opts: {
      cookie?: string;
      token?: string;
      ip?: string;
      body?: unknown;
      method?: string;
    } = {},
  ) =>
    new NextRequest(`https://takoshin.example/api/admin${path}`, {
      method: opts.method ?? "POST",
      headers: {
        host: "takoshin.example",
        "cf-connecting-ip": opts.ip ?? "198.51.100.60",
        ...(opts.cookie ? { cookie: `${SESSION_COOKIE}=${opts.cookie}` } : {}),
        ...(opts.token ? { "x-admin-token": opts.token } : {}),
        ...(opts.body ? { "content-type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it("合言葉は一度送るだけで cookie に替えられる。まちがいは数える", async () => {
    const ok = await tokenLogin(
      adminReq("/login/token", { body: { token: SECRET } }),
    );
    expect(ok.status).toBe(200);
    expect(await isSession(ok.cookies.get(SESSION_COOKIE)?.value)).toBe(true);
    const ip = "198.51.100.61";
    for (let i = 0; i < RATE_LIMIT; i++)
      expect(
        (
          await tokenLogin(
            adminReq("/login/token", { ip, body: { token: WRONG } }),
          )
        ).status,
      ).toBe(401);
    expect(
      (
        await tokenLogin(
          adminReq("/login/token", { ip, body: { token: SECRET } }),
        )
      ).status,
    ).toBe(429);
  });

  it("パスキーの登録は、cookie だけでは通さず、そのたびに合言葉を求める", async () => {
    const session = await createSession();
    const r1 = await registerOptions(
      adminReq("/passkeys/register/options", { cookie: session }),
    );
    expect(r1.status).toBe(401);
    expect(await r1.json()).toEqual({ error: "token_required" });
    expect(
      (
        await registerRoute(
          adminReq("/passkeys/register", {
            cookie: session,
            body: { response: {} },
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await registerOptions(
          adminReq("/passkeys/register/options", {
            cookie: session,
            token: SECRET,
          }),
        )
      ).status,
    ).toBe(200);
    // まちがった合言葉は数える
    const ip = "198.51.100.62";
    for (let i = 0; i < RATE_LIMIT; i++)
      await registerOptions(
        adminReq("/passkeys/register/options", {
          ip,
          cookie: session,
          token: WRONG,
        }),
      );
    expect(
      (
        await registerOptions(
          adminReq("/passkeys/register/options", { ip, token: SECRET }),
        )
      ).status,
    ).toBe(429);
  });

  it("パスキーを外すには合言葉がいり、外すとすべての端末から出る", async () => {
    await db.query(
      `insert into admin_passkeys (id, public_key, name) values ('pk-hard-1', 'x', 'テスト')`,
    );
    const a = await createSession();
    const b = await createSession();
    const denied = await deletePasskeyRoute(
      adminReq("/passkeys/pk-hard-1", { method: "DELETE", cookie: a }),
      ctx("pk-hard-1"),
    );
    expect(denied.status).toBe(401);
    expect(await isSession(a)).toBe(true);
    const ok = await deletePasskeyRoute(
      adminReq("/passkeys/pk-hard-1", {
        method: "DELETE",
        cookie: a,
        token: SECRET,
      }),
      ctx("pk-hard-1"),
    );
    expect(ok.status).toBe(200);
    expect(await isSession(a)).toBe(false);
    expect(await isSession(b)).toBe(false);
    const { rows } = await db.query(
      `select 1 from admin_passkeys where id = 'pk-hard-1'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("すべての端末から出られる（入っている人だけ）", async () => {
    const a = await createSession();
    const b = await createSession();
    expect((await logoutAll(adminReq("/logout/all"))).status).toBe(401);
    expect(await isSession(a)).toBe(true);
    const res = await logoutAll(adminReq("/logout/all", { cookie: a }));
    expect(res.status).toBe(200);
    expect(await isSession(a)).toBe(false);
    expect(await isSession(b)).toBe(false);
  });
});

describe("定時処理の合言葉", () => {
  it("まちがいが続く回線は止め、止めている間は正しくても通さない", async () => {
    const prev = process.env.CRON_SECRET;
    const secret = "c".repeat(40);
    process.env.CRON_SECRET = secret;
    const call = (given: string, ip: string) =>
      cronCleanup(
        new NextRequest("https://takoshin.example/api/cron/cleanup", {
          headers: { authorization: `Bearer ${given}`, "cf-connecting-ip": ip },
        }),
      );
    try {
      const ip = "198.51.100.70";
      for (let i = 0; i < RATE_LIMIT; i++)
        expect((await call("w".repeat(40), ip)).status).toBe(401);
      expect((await call(secret, ip)).status).toBe(429);
      expect((await call(secret, "198.51.100.71")).status).toBe(200);
    } finally {
      restoreEnv("CRON_SECRET", prev);
    }
  });
});
