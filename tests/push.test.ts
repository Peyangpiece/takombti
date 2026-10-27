// 「全員そろった」の通知（仕様書 §4.6・§11.10）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  MAX_SUBSCRIPTIONS,
  addSubscription,
  b64url,
  encryptPayload,
  fromB64url,
  isPushEndpoint,
  hasSubscription,
  notifyCompleted,
  removeSubscription,
  vapidHeader,
  vapidKeys,
  type Sender,
} from "../src/lib/push";
import { createSurvey, deleteSurvey, submitResponse } from "../src/lib/surveys";
import { QUESTIONS } from "../src/data/questions";

const join = (s: string) => s.replace(/\s+/g, "");

// RFC 8291 の付録 A・5 章の例
const RFC = {
  plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  asPublic: join(`BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg
      Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8`),
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: join(`BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-
      JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4`),
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  header:
    join(`DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml
   mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8`),
  cipher:
    join(`8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs
   bI_0LpXMuGvnzQ`),
};

describe("暗号化（RFC 8291）", () => {
  it("RFC の例と同じ結果になる", async () => {
    const out = await encryptPayload(
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      fromB64url(RFC.plaintext),
      {
        asPublic: fromB64url(RFC.asPublic),
        asPrivate: fromB64url(RFC.asPrivate),
        salt: fromB64url(RFC.salt),
      },
    );
    const header = fromB64url(RFC.header);
    expect(header.length).toBe(86);
    expect(b64url(out.slice(0, 86))).toBe(RFC.header);
    expect(b64url(out.slice(86))).toBe(RFC.cipher);
  });
});

describe("送るための署名（RFC 8292）", () => {
  it("公開鍵で確かめられ、送り先の会社を aud に入れる", async () => {
    const keys = await vapidKeys(await createPgliteDb().then(withSchema));
    const h = await vapidHeader(
      "https://fcm.googleapis.com/fcm/send/abc",
      keys,
      0,
    );
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h)!;
    expect(m[4]).toBe(keys.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(m[2])));
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.exp).toBe(12 * 60 * 60);
    const pub = await crypto.subtle.importKey(
      "raw",
      fromB64url(keys.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      fromB64url(m[3]),
      new TextEncoder().encode(`${m[1]}.${m[2]}`),
    );
    expect(ok).toBe(true);
  });
});

async function withSchema(d: Db): Promise<Db> {
  await migrate(d);
  return d;
}

describe("送り先のアドレス", () => {
  it("ブラウザの通知の中継の会社だけを受け付ける", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QJ3")).toBe(true);
    expect(
      isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"),
    ).toBe(true);
    expect(isPushEndpoint("https://wns2-db5p.notify.windows.com/w/?t=1")).toBe(
      true,
    );
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isPushEndpoint("https://evil.example/fcm.googleapis.com")).toBe(
      false,
    );
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(
      false,
    );
    expect(isPushEndpoint("https://169.254.169.254/")).toBe(false);
  });
});

describe("登録と、そろったときの通知", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createPgliteDb();
    await migrate(db);
    setDbForTest(db);
  });
  beforeEach(async () => {
    await db.exec("delete from responses; delete from surveys;");
  });
  afterAll(async () => {
    await db.close();
  });

  // 端末の鍵の組（本物と同じ形）
  async function device(i = 0) {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;
    const raw = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
    return {
      endpoint: `https://fcm.googleapis.com/fcm/send/device${i}`,
      keys: {
        p256dh: b64url(raw),
        auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
      },
    };
  }

  const all = (v = 6) => Array(QUESTIONS.length).fill(v);

  it("受付中の診断だけ登録できる。形のちがうもの・数の上限は断る", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error();
    expect(await addSubscription(s.hostKey, await device())).toBe("ok");
    // 同じ端末をもう一度登録しても 1 件のまま
    expect(await addSubscription(s.hostKey, await device())).toBe("ok");
    expect(
      await addSubscription(s.hostKey, {
        ...(await device()),
        endpoint: "https://example.com/x",
      }),
    ).toBe("invalid");
    expect(await addSubscription("x".repeat(22), await device())).toBe(
      "not_found",
    );
    for (let i = 1; i < MAX_SUBSCRIPTIONS; i++)
      expect(await addSubscription(s.hostKey, await device(i))).toBe("ok");
    expect(
      await addSubscription(s.hostKey, await device(MAX_SUBSCRIPTIONS)),
    ).toBe("full");
    expect(
      await removeSubscription(s.hostKey, (await device(1)).endpoint),
    ).toBe("ok");
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from push_subscriptions`,
    );
    expect(rows[0].n).toBe(MAX_SUBSCRIPTIONS - 1);
  });

  it("そろったら 1 回だけ送り、送り先を消す。中身は暗号化され、管理用の鍵は入らない", async () => {
    const s = await createSurvey({ nickname: "はな", targetCount: 3 });
    if (!s.ok) throw new Error();
    await addSubscription(s.hostKey, await device());
    for (let i = 0; i < 3; i++)
      await submitResponse(s.surveyId, { answers: all() }, `r${i}`);
    const sent: {
      url: string;
      headers: Record<string, string>;
      body: Uint8Array;
    }[] = [];
    const sender: Sender = async (url, init) => {
      sent.push({ url, headers: init.headers, body: init.body });
      return { status: 201 };
    };
    expect(await notifyCompleted(s.surveyId, sender)).toBe(1);
    expect(sent[0].url).toBe("https://fcm.googleapis.com/fcm/send/device0");
    expect(sent[0].headers["content-encoding"]).toBe("aes128gcm");
    expect(sent[0].headers.authorization).toMatch(/^vapid t=/);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      sent[0].body,
    );
    expect(text).not.toContain("はな");
    expect(text).not.toContain(s.hostKey);
    // 2 回目は送らない
    expect(await notifyCompleted(s.surveyId, sender)).toBe(0);
  });

  it("登録があるかを確かめられる。通知を送ったあとは「登録なし」になる。期限を過ぎた診断には登録できない", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error();
    const d = await device(7);
    expect(await hasSubscription(s.hostKey, d.endpoint)).toBe(false);
    await addSubscription(s.hostKey, d);
    expect(await hasSubscription(s.hostKey, d.endpoint)).toBe(true);
    for (let i = 0; i < 3; i++)
      await submitResponse(s.surveyId, { answers: all() }, `q${i}`);
    await notifyCompleted(s.surveyId, async () => ({ status: 201 }));
    expect(await hasSubscription(s.hostKey, d.endpoint)).toBe(false);
    const old = await createSurvey(
      { nickname: "はな", targetCount: 3 },
      new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    );
    if (!old.ok) throw new Error();
    expect(await addSubscription(old.hostKey, await device(8))).toBe(
      "not_open",
    );
  });

  it("診断を消すと送り先も消える", async () => {
    const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
    if (!s.ok) throw new Error();
    await addSubscription(s.hostKey, await device());
    await deleteSurvey(s.hostKey);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from push_subscriptions`,
    );
    expect(rows[0].n).toBe(0);
  });
});
