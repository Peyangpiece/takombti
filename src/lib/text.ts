// 文字の扱い（呼び名の確かめ方、仕様書 §4.3・§8.6）。
import { NG_AFFIX, NG_ALLOW, NG_CONTAINS, NG_EXACT } from "../data/ng-words";

export const NICKNAME_MAX = 12;
// 見た目の 1 文字に許す文字コードの数。絵文字の組み合わせ（家族など）は 1 文字で 10 個ほど使うので余裕を持たせる。
// 見た目の文字数だけで数えると、結合文字（濁点など）を重ねて見た目は 12 文字のまま何万文字にもできるため（§8.6）
export const UNITS_PER_CHAR = 16;

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

// 英字に見えるほかの文字（キリル文字・ギリシャ文字・小さな大文字など）。NFKC ではそろわないので、
// 確かめる前に英字に直す（「fuсk」の с はキリル文字、「ꜱhit」の ꜱ は小さな大文字。§8.6）。
// 全角の英字は NFKC で半角になる。小文字にしてから引くので、小文字だけを持つ
// prettier-ignore
const CONFUSABLES: Record<string, string> = {
  // キリル文字
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o",
  п: "n", р: "p", с: "c", т: "t", у: "y", х: "x", ѕ: "s", і: "i", ї: "i",
  ј: "j", һ: "h", ԁ: "d", ԛ: "q", ԝ: "w", ӏ: "l", ь: "b", г: "r",
  // ギリシャ文字
  α: "a", β: "b", γ: "y", ε: "e", η: "n", ι: "i", κ: "k", μ: "u", ν: "v",
  ο: "o", ρ: "p", σ: "o", ς: "c", τ: "t", υ: "u", χ: "x", ω: "w",
  // 小さな大文字・形の似た英字
  ᴀ: "a", ʙ: "b", ᴄ: "c", ᴅ: "d", ᴇ: "e", ꜰ: "f", ɢ: "g", ʜ: "h", ɪ: "i",
  ᴊ: "j", ᴋ: "k", ʟ: "l", ᴍ: "m", ɴ: "n", ᴏ: "o", ᴘ: "p", ǫ: "q", ʀ: "r",
  ꜱ: "s", ᴛ: "t", ᴜ: "u", ᴠ: "v", ᴡ: "w", ʏ: "y", ᴢ: "z", ı: "i", ȷ: "j",
  ɡ: "g", ɑ: "a", ɩ: "i", ʋ: "u", ł: "l", ø: "o", đ: "d", ħ: "h",
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "g");

export function normalizeForCheck(s: string): string {
  return (
    s
      .normalize("NFKC")
      // 確かめるときは、ZWJ や絵文字の見た目を選ぶ文字も含めて、見えない文字をすべて外す
      .replace(/[\p{Cf}\ufe00-\ufe0f]/gu, "")
      // 空白を外してから合成し直す（NFKC で「゛」は「空白＋結合の濁点」になるので、「は゛か」を「ばか」にそろえる）
      .replace(/\s/gu, "")
      .normalize("NFC")
      .toLowerCase()
      // 記号の付いた英字（ü・é など）は記号を外す（「fück」を「fuck」にそろえる）。かなの濁点には触れない
      .replace(/[\u00c0-\u024f\u1e00-\u1eff]/g, (c) =>
        c.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      )
      .replace(CONFUSABLE_RE, (c) => CONFUSABLES[c] ?? c)
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      // ひらがな・漢字・英字だけを残す。数字と記号は何であれ外す（「し★ね」「し!ね」のように、
      // 決めた区切り文字以外をはさんでもすり抜けられないように）
      .replace(/[^\p{Script=Hiragana}\p{Script=Han}a-z]/gu, "")
  );
}

// 禁止語を含むが名前として普通に使われる言葉（シンデレラ・ころすけ・あほうどり など）。確かめる前に取り除く
function dropAllowed(n: string): string {
  let out = n;
  for (const w of NG_ALLOW) out = out.replaceAll(w, "#");
  return out;
}

// 英字の禁止語（shit・fuck など）は、英字のつながりの始まりか終わりにあるときだけ当てる。
// 「yoshitaka」「toshitaka」のようなローマ字の名前の中にある分は止めない
function hitsLatin(n: string, w: string): boolean {
  let from = 0;
  for (;;) {
    const i = n.indexOf(w, from);
    if (i < 0) return false;
    const before = i === 0 ? "" : n[i - 1];
    const after = n[i + w.length] ?? "";
    if (!/[a-z]/.test(before) || !/[a-z]/.test(after)) return true;
    from = i + 1;
  }
}

const HONORIFICS = /(さん|くん|ちゃん|さま|様|氏|たん|っち)$/;

export function containsNgWord(nickname: string): boolean {
  const n = dropAllowed(normalizeForCheck(nickname));
  if (hitsNg(n)) return true;
  // かなの言葉のあいだに英字を 1 つ入れた形（「しxね」「ちnこ」）も止める。
  // 英字とそれ以外がまざっているときだけ、英字を外したものと、1 文字だけの英字を
  // かなに読みかえたもの（「ちnこ」の n を「ん」に）でも確かめる
  if (/[a-z]/.test(n) && /[^a-z]/.test(n)) {
    const removed = n.replace(/[a-z]+/g, "");
    const read = n.replace(/[a-z]+/g, (r) =>
      r.length === 1 ? (LATIN_AS_KANA[r] ?? "") : "",
    );
    for (const v of [removed, read])
      if (v && hitsNg(dropAllowed(v))) return true;
  }
  return false;
}

// かなの代わりに打たれやすい 1 文字の英字
const LATIN_AS_KANA: Record<string, string> = {
  n: "ん",
  a: "あ",
  i: "い",
  u: "う",
  e: "え",
  o: "お",
};

function hitsNg(n: string): boolean {
  if (
    NG_CONTAINS.some((w) =>
      /^[a-z]+$/.test(w) ? hitsLatin(n, w) : n.includes(w),
    )
  )
    return true;
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
  if (
    charLength(value) > NICKNAME_MAX ||
    value.length > NICKNAME_MAX * UNITS_PER_CHAR
  )
    return { value, error: "too_long" };
  if (containsNgWord(value)) return { value, error: "ng_word" };
  return { value, error: null };
}

export function fillName(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}
