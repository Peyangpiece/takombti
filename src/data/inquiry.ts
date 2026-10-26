// 問い合わせの種類と長さの上限（画面とサーバーで共用）
export const INQUIRY_KINDS = [
  { id: "bug", label: "不具合の報告" },
  { id: "abuse", label: "いじめ・嫌がらせに使われている診断の報告" },
  { id: "data", label: "データの削除・開示などの求め" },
  { id: "other", label: "その他" },
] as const;

export type InquiryKind = (typeof INQUIRY_KINDS)[number]["id"];

export const BODY_MAX = 2000;
export const REPLY_TO_MAX = 200;
export const SURVEY_REF_MAX = 300;
