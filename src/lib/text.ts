// 文字の扱い（呼び名の確かめ方、仕様書 §4.3・§8.6）。
import { NG_CONTAINS, NG_EXACT } from "../data/ng-words";

export const NICKNAME_MAX = 12;

// 見た目の 1 文字を 1 と数える（絵文字や結合文字も 1 文字）
export function charLength(s: string): number {
  const seg = new Intl.Segmenter("ja", { granularity: "grapheme" });
  return [...seg.segment(s)].length;
}

export function normalizeForCheck(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・ー〜~_\-.。、,]/g, "");
}

const HONORIFICS = /(さん|くん|ちゃん|さま|様|氏|たん|っち)$/;

export function containsNgWord(nickname: string): boolean {
  const n = normalizeForCheck(nickname);
  if (NG_CONTAINS.some((w) => n.includes(w))) return true;
  const bare = n.replace(HONORIFICS, "");
  return NG_EXACT.includes(bare) || NG_EXACT.includes(n);
}

export type NicknameError = "empty" | "too_long" | "ng_word";

export function checkNickname(raw: string): {
  value: string;
  error: NicknameError | null;
} {
  // 制御文字は除く。HTML の記号は文字として表示するので、そのままでよい
  const value = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (value.length === 0) return { value, error: "empty" };
  if (charLength(value) > NICKNAME_MAX) return { value, error: "too_long" };
  if (containsNgWord(value)) return { value, error: "ng_word" };
  return { value, error: null };
}

export function fillName(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}
