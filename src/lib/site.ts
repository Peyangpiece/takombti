// 公開するアドレス（NEXT_PUBLIC_SITE_URL）。サイトの地図・検索向けの正規の URL に使う
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

// タイプの紹介ページの URL（小文字。例：/types/intj）
export const typePath = (code: string) => `/types/${code.toLowerCase()}`;
