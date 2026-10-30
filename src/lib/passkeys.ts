// 運営者のパスキー（指紋・顔認証。WebAuthn）。仕様書 §8.6。
// - 最初は合言葉（ADMIN_TOKEN）で入り、その端末のパスキーを登録する。次からはパスキーだけで入れる
// - サーバーが持つのは公開鍵だけ。指紋や顔のデータは端末の外に出ない
// - パスキーか合言葉で入ると、12 時間使える鍵を httpOnly の cookie で渡す（データベースにはハッシュ値だけ）
// - パスキーの登録と取り外しには、そのたびに合言葉がいる。外すと、すべての端末から出る

import { createHash, randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getDb } from "./db";

export const SESSION_COOKIE = "tka_session";
export const SESSION_HOURS = 12;
const CHALLENGE_MINUTES = 5;
const NAME_MAX = 40;
// 運営者は 1 人なので、利用者の ID は決まった値にする
const USER_ID = new TextEncoder().encode("takoshin-admin");

// パスキーは、登録したときのドメインだけで使える（rpID）。リクエストの Host から決める
export interface RelyingParty {
  rpID: string;
  origin: string;
}

export function relyingPartyOf(host: string | null): RelyingParty | null {
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const rpID = host.replace(/:\d+$/, "").toLowerCase();
  const local = rpID === "localhost" || rpID === "127.0.0.1";
  return {
    rpID,
    origin: `${local ? "http" : "https"}://${host.toLowerCase()}`,
  };
}

const hashOf = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function saveChallenge(challenge: string, kind: "register" | "login") {
  const db = await getDb();
  await db.query(
    `insert into admin_challenges (challenge, kind, expires_at) values ($1, $2, $3)`,
    [challenge, kind, new Date(Date.now() + CHALLENGE_MINUTES * 60_000)],
  );
}

// 乱数は 1 回だけ使える。使ったら消す
async function consumeChallenge(
  challenge: string,
  kind: "register" | "login",
): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from admin_challenges where challenge = $1 and kind = $2 and expires_at > now() returning challenge`,
    [challenge, kind],
  );
  return rows.length > 0;
}

interface PasskeyRow {
  id: string;
  public_key: string;
  counter: string | number;
  transports: string | null;
  name: string;
  created_at: Date | string;
  last_used_at: Date | string | null;
}

export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listPasskeys(): Promise<Passkey[]> {
  const db = await getDb();
  const { rows } = await db.query<PasskeyRow>(
    `select * from admin_passkeys order by created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: new Date(r.created_at).toISOString(),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
  }));
}

export async function deletePasskey(id: string): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from admin_passkeys where id = $1 returning id`,
    [id],
  );
  return rows.length > 0;
}

export async function registrationOptions(rp: RelyingParty) {
  const db = await getDb();
  const { rows } = await db.query<{ id: string; transports: string | null }>(
    `select id, transports from admin_passkeys`,
  );
  const options = await generateRegistrationOptions({
    rpName: "たこ診 運営者",
    rpID: rp.rpID,
    userName: "admin",
    userDisplayName: "たこ診 運営者",
    userID: USER_ID,
    attestationType: "none",
    // 同じ端末を二重に登録しない
    excludeCredentials: rows.map((r) => ({
      id: r.id,
      transports: r.transports?.split(",").filter(Boolean),
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  await saveChallenge(options.challenge, "register");
  return options;
}

export function cleanName(v: unknown): string {
  const s = String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, NAME_MAX);
  return s || "パスキー";
}

export async function registerPasskey(
  rp: RelyingParty,
  response: unknown,
  name: unknown,
): Promise<boolean> {
  try {
    const result = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: (c) => consumeChallenge(c, "register"),
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    });
    if (!result.verified) return false;
    const { credential } = result.registrationInfo;
    const db = await getDb();
    await db.query(
      `insert into admin_passkeys (id, public_key, counter, transports, name)
       values ($1, $2, $3, $4, $5)`,
      [
        credential.id,
        Buffer.from(credential.publicKey).toString("base64url"),
        credential.counter,
        credential.transports?.join(",") ?? null,
        cleanName(name),
      ],
    );
    return true;
  } catch {
    return false;
  }
}

export async function loginOptions(rp: RelyingParty) {
  // 端末に入っているパスキーから選んでもらう（どのパスキーがあるかはこちらから教えない）
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "required",
  });
  await saveChallenge(options.challenge, "login");
  return options;
}

// 確かめられたら、新しく作った鍵を返す（cookie に入れる）
export async function loginWithPasskey(
  rp: RelyingParty,
  response: unknown,
): Promise<string | null> {
  try {
    const r = response as AuthenticationResponseJSON;
    if (typeof r?.id !== "string") return null;
    const db = await getDb();
    const { rows } = await db.query<PasskeyRow>(
      `select * from admin_passkeys where id = $1`,
      [r.id],
    );
    const row = rows[0];
    if (!row) return null;
    const result = await verifyAuthenticationResponse({
      response: r,
      expectedChallenge: (c) => consumeChallenge(c, "login"),
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      credential: {
        id: row.id,
        publicKey: new Uint8Array(Buffer.from(row.public_key, "base64url")),
        counter: Number(row.counter),
        transports: row.transports?.split(",").filter(Boolean),
      },
      requireUserVerification: true,
    });
    if (!result.verified) return null;
    await db.query(
      `update admin_passkeys set counter = $2, last_used_at = now() where id = $1`,
      [row.id, result.authenticationInfo.newCounter],
    );
    return createSession();
  } catch {
    return null;
  }
}

export async function createSession(now = new Date()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.query(
    `insert into admin_sessions (token_hash, expires_at) values ($1, $2)`,
    [hashOf(token), new Date(now.getTime() + SESSION_HOURS * 3600_000)],
  );
  return token;
}

export async function isSession(token: string | undefined): Promise<boolean> {
  if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  const db = await getDb();
  const { rows } = await db.query(
    `select 1 from admin_sessions where token_hash = $1 and expires_at > now()`,
    [hashOf(token)],
  );
  return rows.length > 0;
}

export async function endSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = await getDb();
  await db.query(`delete from admin_sessions where token_hash = $1`, [
    hashOf(token),
  ]);
}

// すべての端末から出る（入った記録をすべて消す）。パスキーを外したときにも使う。
// どの記録がどのパスキーで入ったかは持っていないので、外したパスキーで入っていた端末も確実に出すため、すべて消す
export async function endAllSessions(): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from admin_sessions returning token_hash`,
  );
  return rows.length;
}

// 定時処理：切れた乱数と記録を消す
export async function cleanupAdminAuth(): Promise<number> {
  const db = await getDb();
  const a = await db.query(
    `delete from admin_challenges where expires_at <= now() returning challenge`,
  );
  const b = await db.query(
    `delete from admin_sessions where expires_at <= now() returning token_hash`,
  );
  return a.rows.length + b.rows.length;
}
