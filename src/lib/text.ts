// 文字の扱い（呼び名の確かめ方、仕様書 §4.3・§8.6）。
import { NG_AFFIX, NG_CONTAINS, NG_EXACT } from "../data/ng-words";

export const NICKNAME_MAX = 12;

// 見た目の 1 文字を 1 と数える（絵文字や結合文字も 1 文字）
export function charLength(s: string): number {
  const seg = new Intl.Segmenter("ja", { granularity: "grapheme" });
  return [...seg.segment(s)].length;
}

// 見えない文字と、文字の向きを変える文字（U+202E など）。呼び名に入れると、禁止語のあいだに挟んで
// 確かめをすり抜けたり、LINE などで表示の順番を入れかえて別の文に見せたりできるので、取り除く。
// 絵文字をつなぐ U+200D（ZWJ）は、家族の絵文字などに使うので残す
const INVISIBLE =
  /[\u00ad\u061c\u180e\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/g;

export function normalizeForCheck(s: string): string {
  return (
    s
      .normalize("NFKC")
      // 確かめるときは、ZWJ や絵文字の見た目を選ぶ文字も含めて、見えない文字をすべて外す
      .replace(/[\p{Cf}\ufe00-\ufe0f]/gu, "")
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[\s・ー〜~_\-.。、,]/g, "")
  );
}

const HONORIFICS = /(さん|くん|ちゃん|さま|様|氏|たん|っち)$/;

export function containsNgWord(nickname: string): boolean {
  const n = normalizeForCheck(nickname);
  if (NG_CONTAINS.some((w) => n.includes(w))) return true;
  const bare = n.replace(HONORIFICS, "");
  // 名前に短い悪口を付けた形（前か後ろ。「の」をはさんでも）。悪口だけの呼び名は下の NG_EXACT で止める
  const core = bare.replace(/の/g, "");
  if (
    core.length > 2 &&
    NG_AFFIX.some((w) => core.startsWith(w) || core.endsWith(w))
  )
    return true;
  return NG_EXACT.includes(bare) || NG_EXACT.includes(n);
}

export type NicknameError = "empty" | "too_long" | "ng_word";

export function checkNickname(raw: string): {
  value: string;
  error: NicknameError | null;
} {
  // 制御文字と見えない文字は除く。HTML の記号は文字として表示するので、そのままでよい
  const value = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(INVISIBLE, "")
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
