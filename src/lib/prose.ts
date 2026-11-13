// 長い文を、読みやすい短い段落に分ける（仕様書 §4.11・§7.4）。
// 「。」で文に区切り、per 文ずつまとめる。「」や（）の中の「。」では切らない。文は書きかえない

const OPEN = "「『（";
const CLOSE = "」』）";

export function sentences(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (OPEN.includes(c)) depth += 1;
    else if (CLOSE.includes(c)) depth = Math.max(0, depth - 1);
    else if (c === "。" && depth === 0) {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.map((s) => s.trim()).filter(Boolean);
}

export function paragraphs(text: string, per = 2): string[] {
  const list = sentences(text);
  const out: string[] = [];
  for (let i = 0; i < list.length; i += per)
    out.push(list.slice(i, i + per).join(""));
  // 最後の段落が 1 文だけで短いときは、前の段落につなげる（1 行だけの段落を残さない）
  if (
    out.length > 1 &&
    list.length % per === 1 &&
    out[out.length - 1].length < 30
  ) {
    const last = out.pop()!;
    out[out.length - 1] += last;
  }
  return out;
}
