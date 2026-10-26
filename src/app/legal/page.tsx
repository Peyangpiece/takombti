import type { Metadata } from "next";
import { Header } from "@/components/Shell";
import { SELLER, sellerReady } from "@/data/seller";
import { premiumOffer } from "@/lib/stripe";

export const metadata: Metadata = { title: "特定商取引法に基づく表記" };
export const dynamic = "force-dynamic";

// 特定商取引法に基づく表記（特典つきの応援。仕様書 §4.11）
export default function Legal() {
  const offer = premiumOffer();
  const hidden = "請求があれば遅滞なく開示します";
  const rows: [string, string][] = [
    ["販売事業者", SELLER.name],
    ["運営責任者", SELLER.manager],
    ["所在地", SELLER.discloseOnRequest ? hidden : SELLER.address],
    ["電話番号", SELLER.discloseOnRequest ? hidden : SELLER.phone],
    ["メールアドレス", SELLER.email],
    [
      "販売するもの",
      "特典つきの応援：応援した診断の「くわしい分析」と「スペシャルなシェア画像」を、その診断の結果の画面で見られるようにします",
    ],
    [
      "価格",
      offer ? `${offer.price.toLocaleString("ja-JP")} 円（税込）` : "未定",
    ],
    ["商品代金以外の必要料金", "なし（通信料はお客さまのご負担です）"],
    [
      "支払い方法",
      "クレジットカードなど（Stripe の支払いのページで選べるもの）",
    ],
    ["支払いの時期", "支払いのページで手続きをしたとき"],
    [
      "提供の時期",
      "支払いが済みしだい（通常は数秒〜数分）、その診断の結果の画面で見られます",
    ],
    [
      "返品・キャンセル",
      "内容の性質上、提供したあとの返金はできません。支払いが済んでも特典が見られないときは、お問い合わせからご連絡ください。確かめたうえで返金します",
    ],
    [
      "提供の期間",
      "特典は、その診断の保存期限（結果が出てから 180 日）まで見られます。ホストが診断を消すと、特典も見られなくなります",
    ],
  ];
  return (
    <main className="page stack legal">
      <Header />
      <h1>特定商取引法に基づく表記</h1>
      {!sellerReady() && (
        <p className="notice">現在、有料の特典は提供していません。</p>
      )}
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
