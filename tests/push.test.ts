// 「全員そろった」の通知（仕様書 §4.6・§11.10）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDbForTest, type Db } from "../src/lib/db";
import {
  MAX_SUBSCRIPTIONS,
  RESPONDENT_EXTRA,
  addRespondentSubscription,
  addSubscription,
  b64url,
  encryptPayload,
  fromB64url,
  isPushEndpoint,
  hasSubscription,
  notifyCompleted,
  removeRespondentSubscription,
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
  // 通知の中身を、端末の秘密鍵で開く（RFC 8291 の逆。試験のためだけ）
  async function decrypt(
    priv: CryptoKey,
    pub: Uint8Array,
    auth: Uint8Array,
    data: Uint8Array,
  ): Promise<Record<string, unknown>> {
    const subtle = crypto.subtle;
    const salt = data.slice(0, 16);
    const asPublic = data.slice(21, 86);
    const cipher = data.slice(86);
    const hmac = async (key: Uint8Array, msg: Uint8Array) =>
      new Uint8Array(
        await subtle.sign(
          "HMAC",
          await subtle.importKey(
            "raw",
            new Uint8Array(key),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          ),
          new Uint8Array(msg),
        ),
      );
    const cat = (...p: Uint8Array[]) => {
      const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
      let i = 0;
      for (const x of p) {
        out.set(x, i);
        i += x.length;
      }
      return out;
    };
    const te = new TextEncoder();
    const asKey = await subtle.importKey(
      "raw",
      new Uint8Array(asPublic),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const ecdh = new Uint8Array(
      await subtle.deriveBits({ name: "ECDH", public: asKey }, priv, 256),
    );
    const prkKey = await hmac(auth, ecdh);
    const ikm = await hmac(
      prkKey,
      cat(te.encode("WebPush: info\0"), pub, asPublic, Uint8Array.of(1)),
    );
    const prk = await hmac(salt, ikm);
    const cek = (
      await hmac(prk, te.encode("Content-Encoding: aes128gcm\0\x01"))
    ).slice(0, 16);
    const nonce = (
      await hmac(prk, te.encode("Content-Encoding: nonce\0\x01"))
    ).slice(0, 12);
    const plain = new Uint8Array(
      await subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]),
        new Uint8Array(cipher),
      ),
    );
    return JSON.parse(new TextDecoder().decode(plain.slice(0, -1)));
  }

  // 秘密鍵も持つ端末（届いた中身を開いて確かめるため）
  async function openableDevice(name: string) {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;
    const pub = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
    const auth = crypto.getRandomValues(new Uint8Array(16));
    return {
      priv: pair.privateKey,
      pub,
      auth,
      sub: {
        endpoint: `https://web.push.apple.com/${name}`,
        keys: { p256dh: b64url(pub), auth: b64url(auth) },
      },
    };
  }

  describe("答えた人の通知（§4.10）", () => {
    it("答えて受け付けられた回答者の鍵だけが登録できる。受付中だけ", async () => {
      const s = await createSurvey({ nickname: "たろう", targetCount: 3 });
      if (!s.ok) throw new Error();
      const d = await device(20);
      expect(await addRespondentSubscription(s.surveyId, null, d)).toBe(
        "forbidden",
      );
      // 招待のページで鍵を受け取っただけ（まだ答えていない）
      expect(await addRespondentSubscription(s.surveyId, "k-none", d)).toBe(
        "forbidden",
      );
      await submitResponse(s.surveyId, { answers: all() }, "k1");
      expect(
        await addRespondentSubscription(s.surveyId, "k1", {
          ...d,
          endpoint: "https://example.com/x",
        }),
      ).toBe("invalid");
      expect(await addRespondentSubscription("x".repeat(22), "k1", d)).toBe(
        "not_found",
      );
      expect(await addRespondentSubscription(s.surveyId, "k1", d)).toBe("ok");
      // 送り先は答えた人の印と、日にちまでの日時だけ。回答者の鍵は残さない
      const { rows } = await db.query<{
        role: string;
        sec: string | number;
      }>(
        `select role, extract(epoch from created_at)::bigint % 86400 as sec
           from push_subscriptions where survey_id = $1`,
        [s.surveyId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe("respondent");
      expect(Number(rows[0].sec)).toBe(0);
      const cols = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name = 'push_subscriptions'`,
      );
      expect(cols.rows.map((c) => c.column_name).sort()).toEqual(
        [
          "auth",
          "created_at",
          "endpoint",
          "p256dh",
          "role",
          "survey_id",
        ].sort(),
      );
      // やめる
      expect(
        await removeRespondentSubscription(s.surveyId, "k-none", d.endpoint),
      ).toBe("forbidden");
      expect(
        await removeRespondentSubscription(s.surveyId, "k1", d.endpoint),
      ).toBe("ok");
      const after = await db.query(`select 1 from push_subscriptions`);
      expect(after.rows).toHaveLength(0);
      // 結果が出たあとは登録できない
      await submitResponse(s.surveyId, { answers: all() }, "k2");
      await submitResponse(s.surveyId, { answers: all() }, "k3");
      expect(await addRespondentSubscription(s.surveyId, "k1", d)).toBe(
        "not_open",
      );
    });

    it("答えた人の送り先は「人数＋5」台まで。ホストの 5 台とは別に数える", async () => {
      const s = await createSurvey({ nickname: "はな", targetCount: 3 });
      if (!s.ok) throw new Error();
      await submitResponse(s.surveyId, { answers: all() }, "k1");
      for (let i = 0; i < MAX_SUBSCRIPTIONS; i++)
        expect(await addSubscription(s.hostKey, await device(100 + i))).toBe(
          "ok",
        );
      const cap = 3 + RESPONDENT_EXTRA;
      for (let i = 0; i < cap; i++)
        expect(
          await addRespondentSubscription(s.surveyId, "k1", await device(i)),
        ).toBe("ok");
      expect(
        await addRespondentSubscription(s.surveyId, "k1", await device(cap)),
      ).toBe("full");
      // 登録ずみの端末の鍵の更新は、上限でも受け付ける
      expect(
        await addRespondentSubscription(s.surveyId, "k1", await device(0)),
      ).toBe("ok");
    });

    it("そろったら、ホストと答えた人にそれぞれの中身を 1 回だけ送り、送り先を消す", async () => {
      const s = await createSurvey({ nickname: "はな", targetCount: 3 });
      if (!s.ok) throw new Error();
      const host = await openableDevice("host");
      const friend = await openableDevice("friend");
      expect(await addSubscription(s.hostKey, host.sub)).toBe("ok");
      await submitResponse(s.surveyId, { answers: all() }, "k1");
      expect(
        await addRespondentSubscription(s.surveyId, "k1", friend.sub),
      ).toBe("ok");
      await submitResponse(s.surveyId, { answers: all() }, "k2");
      await submitResponse(s.surveyId, { answers: all() }, "k3");
      const sent = new Map<string, Uint8Array>();
      const sender: Sender = async (url, init) => {
        sent.set(url, init.body);
        return { status: 201 };
      };
      expect(await notifyCompleted(s.surveyId, sender)).toBe(2);
      const toHost = await decrypt(
        host.priv,
        host.pub,
        host.auth,
        sent.get(host.sub.endpoint)!,
      );
      const toFriend = await decrypt(
        friend.priv,
        friend.pub,
        friend.auth,
        sent.get(friend.sub.endpoint)!,
      );
      expect(toHost).toEqual({
        title: "そろった！",
        body: "たこ診の診断に全員が答えました。結果を見てみよう",
        surveyId: s.surveyId,
      });
      expect(toFriend).toEqual({
        title: "結果が出ました",
        body: "あなたが答えた診断に、みんなの答えがそろいました。次は、あなたが周りからどう見えているか聞いてみる？",
        surveyId: s.surveyId,
        kind: "respondent",
      });
      expect(JSON.stringify(toFriend)).not.toContain("はな");
      const { rows } = await db.query(`select 1 from push_subscriptions`);
      expect(rows).toHaveLength(0);
      expect(await notifyCompleted(s.surveyId, sender)).toBe(0);
    });

    it("同じ端末がホストとしても登録しているときは、ホストの送り先のまま", async () => {
      const s = await createSurvey({ nickname: "はな", targetCount: 3 });
      if (!s.ok) throw new Error();
      const d = await device(50);
      await submitResponse(s.surveyId, { answers: all() }, "k1");
      expect(await addSubscription(s.hostKey, d)).toBe("ok");
      expect(await addRespondentSubscription(s.surveyId, "k1", d)).toBe("ok");
      const { rows } = await db.query<{ role: string }>(
        `select role from push_subscriptions`,
      );
      expect(rows.map((r) => r.role)).toEqual(["host"]);
      expect(await hasSubscription(s.hostKey, d.endpoint)).toBe(true);
    });
  });
});
