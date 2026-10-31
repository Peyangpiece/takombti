// 2 つの結果を比べる道具（仕様書 §4.15「2 人の結果を並べる」・§4.11「前回との比較」）。
// 画面とサーバーで共用する。データベースには触らない
import { AXES, POLE_LABEL, matchesOf, type TypeCode } from "../data/framework";
import type { Pole } from "../data/questions";

// 公開カード（S7）に出している、軸ごとの値だけ
export interface AxisPoint {
  axis: string;
  pole: Pole;
  percent: number;
  tie: boolean;
}

// 公開リンクの ID の形（招待リンク・公開リンクと同じ。§8.6）
const SHARE_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function isShareId(v: string): boolean {
  return SHARE_ID.test(v);
}

// 貼り付けられた公開カードの URL（https://…/r/{shareId}?from=copy など）か、shareId だけから、shareId を取り出す。
// 形がちがえば null（データベースには問い合わせない）
export function shareIdFrom(input: string): string | null {
  const s = input.trim();
  if (isShareId(s)) return s;
  const m = s.match(/(?:^|\/)r\/([A-Za-z0-9_-]{16,64})(?=$|[/?#])/);
  return m ? m[1] : null;
}

export function comparePath(a: string, b: string): string {
  return `/r/${a}/vs/${b}`;
}

// 公開カード（shareId）の画面で貼り付けられた値から、並べるページの行き先を決める
export function compareTarget(
  shareId: string,
  input: string,
): { ok: true; path: string } | { ok: false; error: "format" | "self" } {
  const other = shareIdFrom(input);
  if (!other) return { ok: false, error: "format" };
  if (other === shareId) return { ok: false, error: "self" };
  return { ok: true, path: comparePath(shareId, other) };
}

// 左の極（E・S・T・J）の側の割合（0〜100）。ど真ん中は 50
export function leftShare(a: AxisPoint): number {
  if (a.tie) return 50;
  const def = AXES.find((x) => x.axis === a.axis);
  return def && a.pole === def.left ? a.percent : 100 - a.percent;
}

// 2 人の軸の近さ（§4.15）。差は、左の極の側の割合どうしの差（0〜100 ポイント）
// - close：同じ側で、差が 20 ポイント未満
// - same_side：同じ側で、差が 20 ポイント以上
// - near：文字がちがう（またはどちらかがど真ん中）が、差が 20 ポイント未満
// - opposite：反対の側で、差が 20 ポイント以上
// - apart：片方がど真ん中で、もう片方は 20 ポイント以上はなれている
export type Closeness = "close" | "same_side" | "near" | "opposite" | "apart";

export const CLOSE_GAP = 20;

export const CLOSENESS_LABEL: Record<Closeness, string> = {
  close: "この軸は近い",
  same_side: "同じ側。寄り方の強さはちがう",
  near: "文字はちがっても、どちらも真ん中近くで差は小さい",
  opposite: "この軸は反対",
  apart: "片方はど真ん中、もう片方ははっきり寄っている",
};

export function axisCloseness(
  a: AxisPoint,
  b: AxisPoint,
): { kind: Closeness; gap: number } {
  const gap = Math.abs(leftShare(a) - leftShare(b));
  const small = gap < CLOSE_GAP;
  if (a.tie && b.tie) return { kind: "near", gap };
  if (a.tie || b.tie) return { kind: small ? "near" : "apart", gap };
  if (a.pole === b.pole) return { kind: small ? "close" : "same_side", gap };
  return { kind: small ? "near" : "opposite", gap };
}

// §7.8 の相性（おまけ）で、どちらかがもう一方を挙げているか。この決まりでは関係は両方向で同じ
export type Match = "same" | "easy" | "spark" | null;

export function matchBetween(a: TypeCode, b: TypeCode): Match {
  if (a === b) return "same";
  const m = matchesOf(a);
  if (m.easy === b) return "easy";
  if (m.spark === b) return "spark";
  return null;
}

export const MATCH_LABEL: Record<Exclude<Match, null>, string> = {
  same: "2 人は同じタイプ",
  easy: "一緒にいるとラクな組み合わせ",
  spark: "刺激をくれる組み合わせ",
};

// 軸の値を「外向 72%」「どちらとも（50%）」の形にする
export function pointLabel(a: AxisPoint): string {
  return a.tie
    ? "どちらとも（50%）"
    : `${POLE_LABEL[a.pole].name} ${a.percent}%`;
}

// 前回から今回への、軸ごとの変化（§4.11）。同じ側なら「外向 72% → 61%」、入れかわったら「外向 55% → 内向 60%」
export function axisChange(
  prev: AxisPoint,
  now: AxisPoint,
): { text: string; flipped: boolean } {
  const flipped = !prev.tie && !now.tie && prev.pole !== now.pole;
  const same = !prev.tie && !now.tie && prev.pole === now.pole;
  return {
    text: same
      ? `${pointLabel(prev)} → ${now.percent}%`
      : `${pointLabel(prev)} → ${pointLabel(now)}`,
    flipped,
  };
}

// 日本時間の「M月D日」
export function monthDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return month && day ? `${month}月${day}日` : null;
}

const DAY = 24 * 60 * 60 * 1000;

// 結果が出てから days 日以上たったか（§4.2 の「もう一度聞いてみる？」）
export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY);
}
