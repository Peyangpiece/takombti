// タコ占い（特典つきの応援のお礼。仕様書 §4.11）。
// - 中身はタイプに合わせ、一言・あるある・アドバイスは人（診断）ごとに、今日の運勢・ひとこと・ラッキードリンク・
//   ラッキーカラーは人と日（日本時間）ごとに決まる。同じ人が同じ日に見れば、いつも同じ結果になる
// - 見るには合言葉がいる。合言葉は、支払いが済んだ診断に 1 つずつ作り、その診断の結果の画面にだけ出す
// - 合言葉は 40 ビットの乱数。まちがいが続く回線は 1 時間止めるので、総当たりでは当てられない

import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";
import { jstDay } from "./visits";
import { getType, type TypeCode } from "../data/framework";
import {
  DAILY_MESSAGES,
  LUCKY_COLORS,
  LUCKY_DRINKS,
  TYPE_FORTUNES,
} from "../data/fortunes";

// 読みまちがえやすい文字（I・L・O・U）を除いた 32 文字（Crockford の base32）
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newFortuneCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % 32];
  return `TAKO-${s.slice(0, 4)}-${s.slice(4)}`;
}

// 入れた合言葉をそろえる（小文字・空白・ハイフン・読みまちがえやすい文字を許す）
export function normalizeFortuneCode(input: unknown): string | null {
  const raw = String(input ?? "")
    .toUpperCase()
    .replace(/[\s\-‐－ー_]/g, "")
    .replace(/^TAKO/, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(raw)) return null;
  return `TAKO-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// 文字列から決まる乱数（同じ種なら同じ並び）
function seeded(seed: string): () => number {
  let a = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(list: T[], rnd: () => number): T =>
  list[Math.floor(rnd() * list.length)];

// 1〜5 の星。少し良いほうに寄せる（占いは前向きに）
const stars = (rnd: () => number) =>
  [2, 3, 3, 4, 4, 4, 5, 5][Math.floor(rnd() * 8)];

export interface Fortune {
  type: TypeCode;
  typeName: string;
  date: string;
  core: string;
  aru: string;
  advice: string;
  today: { overall: number; love: number; friends: number; study: number };
  message: string;
  drink: string;
  color: string;
}

export function fortuneFor(
  type: TypeCode,
  surveyId: string,
  now = new Date(),
): Fortune {
  const t = TYPE_FORTUNES[type];
  const person = seeded(`person|${surveyId}`);
  const date = jstDay(now);
  const day = seeded(`day|${surveyId}|${date}`);
  return {
    type,
    typeName: getType(type).name,
    date,
    core: pick(t.core, person),
    aru: pick(t.aru, person),
    advice: pick(t.advice, person),
    today: {
      overall: stars(day),
      love: stars(day),
      friends: stars(day),
      study: stars(day),
    },
    message: pick(DAILY_MESSAGES, day),
    drink: pick(LUCKY_DRINKS, day),
    color: pick(LUCKY_COLORS, day),
  };
}

// 合言葉から、その診断の今日の占いを出す。合言葉がちがえば null
export async function fortuneByCode(
  input: unknown,
  now = new Date(),
): Promise<Fortune | null> {
  const code = normalizeFortuneCode(input);
  if (!code) return null;
  const db = await getDb();
  const { rows } = await db.query<{
    id: string;
    result: { type: TypeCode } | string | null;
  }>(
    `select id, result from surveys
      where fortune_code = $1 and premium_at is not null and status = 'completed'`,
    [code],
  );
  const row = rows[0];
  if (!row?.result) return null;
  const result =
    typeof row.result === "string" ? JSON.parse(row.result) : row.result;
  return fortuneFor(result.type, row.id, now);
}
