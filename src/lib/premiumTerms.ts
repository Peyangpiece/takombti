// 特典つきの応援の、申し込みの条件（仕様書 §4.11）。画面（SupportCard）・Stripe の支払いのページ・
// サーバーの確かめで同じ値を使う。画面の JS からも読むので、サーバーだけの部品（データベースなど）は入れない

// 特典を見られる日（保存期限までの残り日数。切り上げ）が、これより少ない診断では売らない
// （支払ってすぐ見られなくなるのを防ぐ）
export const MIN_PREMIUM_DAYS = 7;

// 支払いの時期と方法（特定商取引法 第12条の6 の最終確認の表示）
export const PAYMENT_TERMS =
  "クレジットカード。申し込んだときに支払いが確定します";

// 残り日数（HostView.daysLeft）から、特典つきの応援を出せるか
export function premiumSellable(daysLeft: number | null): boolean {
  return daysLeft !== null && daysLeft >= MIN_PREMIUM_DAYS;
}

// 保存期限の日付（日本時間の「M月D日」）
export function jstMonthDay(at: string | Date): string {
  const jst = new Date(new Date(at).getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}
