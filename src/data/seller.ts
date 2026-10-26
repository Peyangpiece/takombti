// 特定商取引法に基づく表記（/legal）。特典つきの応援（有料）を出すときに必要。
// すべての項目（* の付いたもの）がそろうまで、特典つきの応援は出さない。
// 住所と電話番号は、個人の場合「請求があれば遅滞なく開示します」と書いて省くことができる（条件は消費者庁の案内を確かめる）
export const SELLER = {
  // * 販売事業者（個人なら氏名）
  name: "",
  // * 運営責任者
  manager: "",
  // * 所在地（省くときは空のまま。下の discloseOnRequest を true にする）
  address: "",
  // * 電話番号（同上）
  phone: "",
  // * 連絡先のメールアドレス
  email: "",
  // 住所と電話番号を、請求があれば開示するとして省くか
  discloseOnRequest: false,
};

export function sellerReady(s = SELLER): boolean {
  const base = s.name && s.manager && s.email;
  const contact = s.discloseOnRequest || (s.address && s.phone);
  return Boolean(base && contact);
}
