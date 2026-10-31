// 「全員そろった」の通知（仕様書 §4.6・§11.10）。Web Push の標準（RFC 8030・8291・8292）を、
// 外部の部品を使わずに Web Crypto だけで組む（Cloudflare Workers でも Node.js でも動くように）。
// - 通知を送るための鍵（VAPID）は、初めて使うときに作ってデータベースに置く（設定するシークレットを増やさない）
// - 送り先（購読）は診断ごとに持ち、通知を送ったら消す。診断を消すと購読も消える
// - 通知の中身は端末ごとの鍵で暗号化するので、通知を中継する会社（Apple・Google など）には読めない
// - 管理用の鍵はサーバーにないので、通知には入れない。通知を押すと、端末に覚えてある鍵で結果を開く
// - 答えた友達も、結果が出たことだけを知らせてもらえる（role = 'respondent'。§4.10）。
//   どの回答の人かは残さず（回答の行と結びつけない）、登録した日時も日にちまでにする

import { getDb, type Queryable } from "./db";
import { effectiveStatus, hashKey } from "./surveys";
import { SITE_URL } from "./site";

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

// 1 つの診断に登録できる、作った人の端末の数（同じ人のスマホとパソコンなど）
export const MAX_SUBSCRIPTIONS = 5;
// 答えた友達の端末は、1 つの診断に「人数＋この数」まで（1 人が 2 台で登録することもあるため、少しだけ余らせる）
export const RESPONDENT_EXTRA = 5;
// 通知を中継する会社が、届けられないときに持っておく時間（秒）
const TTL = 24 * 60 * 60;

// 送り先として受け付ける、ブラウザの通知の中継の会社。ほかのアドレスへは送らない
// （好きなアドレスを登録されて、このサーバーから任意の相手へ送らされるのを防ぐ）
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isPushEndpoint(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 1000) return false;
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      u.port === "" &&
      u.username === "" &&
      PUSH_HOSTS.some((re) => re.test(u.hostname))
    );
  } catch {
    return false;
  }
}

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle.importKey(
    "raw",
    concat(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await subtle.sign("HMAC", k, concat(data)));
}

// 圧縮していない P-256 の公開鍵（0x04 + x + y の 65 バイト）を JWK の x・y にする
function pointToJwk(raw: Uint8Array): { x: string; y: string } {
  if (raw.length !== 65 || raw[0] !== 4) throw new Error("bad public key");
  return { x: b64url(raw.slice(1, 33)), y: b64url(raw.slice(33)) };
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// RFC 8291：通知の中身を aes128gcm で暗号化する。as（送る側の使い捨ての鍵）と salt は試験のときだけ渡す
export async function encryptPayload(
  target: { p256dh: string; auth: string },
  plaintext: Uint8Array,
  fixed?: { asPublic: Uint8Array; asPrivate: Uint8Array; salt: Uint8Array },
): Promise<Uint8Array> {
  const uaPublic = fromB64url(target.p256dh);
  const authSecret = fromB64url(target.auth);
  if (authSecret.length !== 16) throw new Error("bad auth secret");
  let asPublic: Uint8Array;
  let asPrivateKey: CryptoKey;
  if (fixed) {
    asPublic = fixed.asPublic;
    asPrivateKey = await subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        d: b64url(fixed.asPrivate),
        ...pointToJwk(fixed.asPublic),
      },
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
  } else {
    const pair = (await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;
    asPublic = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
    asPrivateKey = pair.privateKey;
  }
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const uaKey = await subtle.importKey(
    "raw",
    concat(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivateKey, 256),
  );
  const prkKey = await hmac(authSecret, ecdh);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, Uint8Array.of(1)));
  const prk = await hmac(salt, ikm);
  const cek = (
    await hmac(prk, enc.encode("Content-Encoding: aes128gcm\0\x01"))
  ).slice(0, 16);
  const nonce = (
    await hmac(prk, enc.encode("Content-Encoding: nonce\0\x01"))
  ).slice(0, 12);
  const aes = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 1 つのレコードで送る。最後のレコードの印（0x02）を付け、詰め物はしない
  const cipher = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aes,
      concat(plaintext, Uint8Array.of(2)),
    ),
  );
  // 見出し：salt（16）・レコードの大きさ（4096）・鍵の長さ（65）・送る側の公開鍵
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

export interface VapidKeys {
  publicKey: string; // 65 バイトの公開鍵（base64url）。ブラウザの購読に使う
  privateJwk: JsonWebKey;
}

let cachedKeys: VapidKeys | null = null;

// 通知を送るための鍵。なければ作って置く（同時に作られても、先に入ったほうを使う）
export async function vapidKeys(q?: Queryable): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;
  const db = q ?? (await getDb());
  const read = async () => {
    const { rows } = await db.query<{
      public_key: string;
      private_jwk: string;
    }>(`select public_key, private_jwk from push_keys where id = 1`);
    return rows[0]
      ? {
          publicKey: rows[0].public_key,
          privateJwk: JSON.parse(rows[0].private_jwk) as JsonWebKey,
        }
      : null;
  };
  let keys = await read();
  if (!keys) {
    const pair = (await subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const pub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
    const jwk = await subtle.exportKey("jwk", pair.privateKey);
    await db.query(
      `insert into push_keys (id, public_key, private_jwk) values (1, $1, $2)
       on conflict (id) do nothing`,
      [b64url(pub), JSON.stringify(jwk)],
    );
    keys = await read();
    if (!keys) throw new Error("push keys");
  }
  cachedKeys = keys;
  return keys;
}

// RFC 8292：送り先の会社に、だれが送るかを示す署名（12 時間有効）
export async function vapidHeader(
  endpoint: string,
  keys: VapidKeys,
  now = Date.now(),
): Promise<string> {
  const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 12 * 60 * 60,
        sub: SITE_URL.startsWith("https:")
          ? SITE_URL
          : "https://takoshin.daigakunote.com",
      }),
    ),
  );
  const key = await subtle.importKey(
    "jwk",
    keys.privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // Web Crypto の署名は r と s を並べた 64 バイトで、JWT の ES256 の形と同じ
  const sig = new Uint8Array(
    await subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(`${head}.${body}`),
    ),
  );
  return `vapid t=${head}.${body}.${b64url(sig)}, k=${keys.publicKey}`;
}

export type SubscribeStatus =
  "ok" | "not_found" | "not_open" | "invalid" | "full";

// ブラウザの購読（PushSubscription.toJSON() の形）から、送り先と端末の鍵を取り出す。形がちがえば null
export function parseSubscription(input: unknown): PushTarget | null {
  const sub = input as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (
    !isPushEndpoint(endpoint) ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]{20,24}$/.test(auth)
  )
    return null;
  return { endpoint, p256dh, auth };
}

// 管理用の鍵を持つ人の端末を、その診断の送り先に登録する
export async function addSubscription(
  hostKey: string,
  input: unknown,
): Promise<SubscribeStatus> {
  const target = parseSubscription(input);
  if (!target) return "invalid";
  const { endpoint, p256dh, auth } = target;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{
      id: string;
      status: "open" | "completed" | "expired";
      expires_at: Date;
      question_version: number;
    }>(
      `select id, status, expires_at, question_version from surveys
        where host_key_hash = $1 for update`,
      [hashKey(hostKey)],
    );
    const row = rows[0];
    if (!row) return "not_found";
    // 期限を過ぎた（定時処理の前の）診断も、通知が届くことはないので受け付けない
    if (effectiveStatus(row, new Date()) !== "open") return "not_open";
    const { rows: n } = await tx.query<{ n: number }>(
      `select count(*)::int as n from push_subscriptions
        where survey_id = $1 and endpoint <> $2 and role = 'host'`,
      [row.id, endpoint],
    );
    if (Number(n[0].n) >= MAX_SUBSCRIPTIONS) return "full";
    // 同じ端末が答えた友達として登録されていたら、作った人の送り先に切りかえる（結果を開けるように）
    await tx.query(
      `insert into push_subscriptions (survey_id, endpoint, p256dh, auth, role)
       values ($1, $2, $3, $4, 'host')
       on conflict (survey_id, endpoint) do update set p256dh = $3, auth = $4, role = 'host'`,
      [row.id, endpoint, p256dh, auth],
    );
    return "ok";
  });
}

export type RespondentSubscribeStatus = SubscribeStatus | "forbidden";

// 答えた友達の端末を、その診断の「結果が出た」の送り先に登録する（§4.10）。
// 回答者の鍵（cookie）で、その診断に答えて受け付けられた人かを確かめる。
// 送り先には、どの回答の人かを残さない（回答者の鍵も、回答の行も結びつけない）
export async function addRespondentSubscription(
  surveyId: string,
  respondentKey: string | null,
  input: unknown,
): Promise<RespondentSubscribeStatus> {
  if (!respondentKey) return "forbidden";
  const target = parseSubscription(input);
  if (!target) return "invalid";
  const { endpoint, p256dh, auth } = target;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{
      id: string;
      status: "open" | "completed" | "expired";
      expires_at: Date;
      question_version: number;
      target_count: number;
    }>(
      `select id, status, expires_at, question_version, target_count from surveys
        where id = $1 for update`,
      [surveyId],
    );
    const row = rows[0];
    if (!row) return "not_found";
    const { rows: answered } = await tx.query(
      `select 1 from responses where survey_id = $1 and respondent_key = $2`,
      [surveyId, respondentKey],
    );
    if (answered.length === 0) return "forbidden";
    // 結果がもう出た（通知はもう送った）・期限を過ぎた診断には、通知が届くことはないので受け付けない
    if (effectiveStatus(row, new Date()) !== "open") return "not_open";
    const { rows: n } = await tx.query<{ n: number }>(
      `select count(*)::int as n from push_subscriptions
        where survey_id = $1 and endpoint <> $2 and role = 'respondent'`,
      [row.id, endpoint],
    );
    if (Number(n[0].n) >= Number(row.target_count) + RESPONDENT_EXTRA)
      return "full";
    // 作った人の送り先として登録ずみの端末なら、作った人の通知のままにする（鍵だけ新しくする）
    await tx.query(
      `insert into push_subscriptions (survey_id, endpoint, p256dh, auth, role, created_at)
       values ($1, $2, $3, $4, 'respondent', date_trunc('day', now(), 'UTC'))
       on conflict (survey_id, endpoint) do update set p256dh = $3, auth = $4`,
      [row.id, endpoint, p256dh, auth],
    );
    return "ok";
  });
}

// 答えた友達が、通知をやめる。答えた人の鍵（cookie）があるときだけ、答えた友達の送り先から消す
export async function removeRespondentSubscription(
  surveyId: string,
  respondentKey: string | null,
  endpoint: unknown,
): Promise<"ok" | "forbidden" | "invalid"> {
  if (!respondentKey) return "forbidden";
  if (typeof endpoint !== "string" || endpoint.length > 1000) return "invalid";
  const db = await getDb();
  const { rows } = await db.query(
    `select 1 from responses where survey_id = $1 and respondent_key = $2`,
    [surveyId, respondentKey],
  );
  if (rows.length === 0) return "forbidden";
  await db.query(
    `delete from push_subscriptions
      where survey_id = $1 and endpoint = $2 and role = 'respondent'`,
    [surveyId, endpoint],
  );
  return "ok";
}

// この端末（送り先）が、その診断に登録されているか。画面の「通知を受け取る／やめる」を正しく出すため
//（結果が出たあとに人数をふやして受付を再開したときなど、登録はもう消えている）
export async function hasSubscription(
  hostKey: string,
  endpoint: unknown,
): Promise<boolean | null> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return null;
  const db = await getDb();
  const { rows } = await db.query<{ ok: number }>(
    `select 1 as ok from push_subscriptions p join surveys s on s.id = p.survey_id
      where s.host_key_hash = $1 and p.endpoint = $2 and p.role = 'host'`,
    [hashKey(hostKey), endpoint],
  );
  return rows.length > 0;
}

export async function removeSubscription(
  hostKey: string,
  endpoint: unknown,
): Promise<"ok" | "not_found" | "invalid"> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return "invalid";
  const db = await getDb();
  const { rows } = await db.query<{ id: string }>(
    `select id from surveys where host_key_hash = $1`,
    [hashKey(hostKey)],
  );
  if (!rows[0]) return "not_found";
  await db.query(
    `delete from push_subscriptions where survey_id = $1 and endpoint = $2`,
    [rows[0].id, endpoint],
  );
  return "ok";
}

export type Sender = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: Uint8Array },
) => Promise<{ status: number }>;

const defaultSender: Sender = (url, init) =>
  fetch(url, { ...init, body: concat(init.body) });

// 結果が出た診断の送り先に通知を送り、送り先を消す（1 回きり）。失敗しても回答の受付には響かせない
export async function notifyCompleted(
  surveyId: string,
  send: Sender = defaultSender,
): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<PushTarget & { role: string }>(
    `delete from push_subscriptions where survey_id = $1
      returning endpoint, p256dh, auth, role`,
    [surveyId],
  );
  if (rows.length === 0) return 0;
  const keys = await vapidKeys(db);
  const payloads = {
    host: enc.encode(
      JSON.stringify({
        title: "そろった！",
        // ロック画面に出るので、呼び名は入れない（ほかの人に見られても、だれの診断か分からないように）
        body: "たこ診の診断に全員が答えました。結果を見てみよう",
        surveyId,
      }),
    ),
    // 答えた友達には、結果が出たことだけを知らせる（結果を見られるのは作った人だけ。§4.10）。呼び名は入れない
    respondent: enc.encode(
      JSON.stringify({
        title: "結果が出ました",
        body: "あなたが答えた診断に、みんなの答えがそろいました。次は、あなたが周りからどう見えているか聞いてみる？",
        surveyId,
        kind: "respondent",
      }),
    ),
  };
  let sent = 0;
  await Promise.all(
    rows.map(async (t) => {
      try {
        const body = await encryptPayload(
          t,
          t.role === "respondent" ? payloads.respondent : payloads.host,
        );
        const res = await send(t.endpoint, {
          method: "POST",
          headers: {
            authorization: await vapidHeader(t.endpoint, keys),
            "content-encoding": "aes128gcm",
            "content-type": "application/octet-stream",
            ttl: String(TTL),
            urgency: "normal",
          },
          body,
        });
        if (res.status >= 200 && res.status < 300) sent++;
      } catch {
        // 届かなくても、結果は回答状況の画面とトップで見られる
      }
    }),
  );
  return sent;
}
