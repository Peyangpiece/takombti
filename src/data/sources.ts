// 招待リンク・公開リンクが、どの送り方で開かれたか（運営者が /admin で見る）。画面とサーバーで共用。
// リンクの後ろに ?from=<id> を付けて送り、開かれたときに日ごとの件数だけを数える（仕様書 §8.1）
export const VISIT_SOURCES = [
  { id: "line", label: "LINE" },
  { id: "x", label: "X" },
  { id: "qr", label: "QR コード" },
  { id: "copy", label: "コピー" },
  { id: "share", label: "その他の送り方" },
  // 目印のないリンク（目印を付ける前に送ったリンク・手で打ったアドレスなど）
  { id: "none", label: "目印なし" },
] as const;

export type VisitSource = (typeof VISIT_SOURCES)[number]["id"];

// 数えるページ。トップは、結果を公開リンクなしでシェアしたときの行き先なので、目印があるときだけ数える
export const VISIT_PAGES = [
  { id: "invite", label: "招待", note: "招待リンク（/a/）" },
  { id: "public", label: "公開", note: "結果の公開リンク（/r/）" },
  {
    id: "top",
    label: "トップ",
    note: "公開リンクを作らずに結果をシェアしたときのトップ",
  },
] as const;

export type VisitPage = (typeof VISIT_PAGES)[number]["id"];

export function isVisitSource(v: unknown): v is VisitSource {
  return VISIT_SOURCES.some((s) => s.id === v);
}

export function isVisitPage(v: unknown): v is VisitPage {
  return VISIT_PAGES.some((p) => p.id === v);
}
