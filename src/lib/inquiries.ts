// 問い合わせの受付と、運営者による確認（/contact・/admin）。
import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";
import { UNITS_PER_CHAR, charLength } from "./text";
import {
  BODY_MAX,
  INQUIRY_KINDS,
  REPLY_TO_MAX,
  SURVEY_REF_MAX,
  type InquiryKind,
} from "../data/inquiry";

export { INQUIRY_KINDS, type InquiryKind };

// 問い合わせは受け付けてから 180 日で消す
export const KEEP_INQUIRY_DAYS = 180;
const DAY = 24 * 60 * 60 * 1000;

export interface Inquiry {
  id: number;
  kind: InquiryKind;
  body: string;
  replyTo: string | null;
  surveyRef: string | null;
  // surveyRef から読み取った招待リンクの ID（あれば）
  surveyId: string | null;
  handled: boolean;
  createdAt: string;
}

function clean(v: unknown): string {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}

// 招待リンク（…/a/<ID>）または ID そのものから、診断の ID を取り出す
export function surveyIdFrom(ref: string | null): string | null {
  if (!ref) return null;
  const m =
    ref.match(/\/a\/([A-Za-z0-9_-]{16,64})/) ??
    ref.match(/^([A-Za-z0-9_-]{16,64})$/);
  return m ? m[1] : null;
}

export type InquiryError = "bad_kind" | "empty" | "too_long";

export async function createInquiry(input: {
  kind: unknown;
  body: unknown;
  replyTo?: unknown;
  surveyRef?: unknown;
}): Promise<{ ok: true } | { ok: false; error: InquiryError }> {
  const kind = String(input.kind ?? "");
  if (!INQUIRY_KINDS.some((k) => k.id === kind))
    return { ok: false, error: "bad_kind" };
  const body = clean(input.body);
  const replyTo = clean(input.replyTo);
  // 管理用リンク（# より後ろに鍵がある）を貼られても、鍵は保存しない
  const surveyRef = clean(input.surveyRef).split("#")[0].trim();
  if (body.length === 0) return { ok: false, error: "empty" };
  // 見た目の文字数（書記素）のほかに、文字コードの数でも上限を置く。結合文字を重ねると、見た目は短いまま
  // いくらでも長くできるため（§8.6）
  if (
    charLength(body) > BODY_MAX ||
    charLength(replyTo) > REPLY_TO_MAX ||
    charLength(surveyRef) > SURVEY_REF_MAX ||
    body.length > BODY_MAX * UNITS_PER_CHAR ||
    replyTo.length > REPLY_TO_MAX * UNITS_PER_CHAR ||
    surveyRef.length > SURVEY_REF_MAX * UNITS_PER_CHAR
  ) {
    return { ok: false, error: "too_long" };
  }
  const db = await getDb();
  await db.query(
    `insert into inquiries (kind, body, reply_to, survey_ref) values ($1, $2, $3, $4)`,
    [kind, body, replyTo || null, surveyRef || null],
  );
  return { ok: true };
}

interface Row {
  id: string | number;
  kind: InquiryKind;
  body: string;
  reply_to: string | null;
  survey_ref: string | null;
  handled: boolean;
  created_at: Date | string;
}

export async function listInquiries(): Promise<Inquiry[]> {
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `select * from inquiries order by handled asc, created_at desc limit 200`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    body: r.body,
    replyTo: r.reply_to,
    surveyRef: r.survey_ref,
    surveyId: surveyIdFrom(r.survey_ref),
    handled: r.handled,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function setInquiryHandled(
  id: number,
  handled: boolean,
): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(
    `update inquiries set handled = $2 where id = $1 returning id`,
    [id, handled],
  );
  return rows.length > 0;
}

export async function deleteInquiry(id: number): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from inquiries where id = $1 returning id`,
    [id],
  );
  return rows.length > 0;
}

export async function cleanupInquiries(now = new Date()): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query(
    `delete from inquiries where created_at <= $1 returning id`,
    [new Date(now.getTime() - KEEP_INQUIRY_DAYS * DAY)],
  );
  return rows.length;
}

// 合言葉を比べる。長さの違いや一致した位置が、かかる時間から分からないようにする。
// 16 文字未満の合言葉は、設定のまちがいとみなして通さない
export function secretMatches(
  given: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 16 || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

// 運営者の合言葉（ADMIN_TOKEN）と比べる
export function isAdmin(
  token: string | null,
  secret = process.env.ADMIN_TOKEN,
): boolean {
  return secretMatches(token, secret);
}
