import type { Metadata } from "next";
import { Header } from "@/components/Shell";
import { SELLER, sellerReady } from "@/data/seller";
import { premiumOffer } from "@/lib/stripe";
import { MIN_PREMIUM_DAYS } from "@/lib/premiumTerms";

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
      "特典つきの応援：応援した診断の「くわしい分析」と「タコ占い」の合言葉を、その診断の結果の画面でお届けします。スペシャルなシェア画像に「サポーター」の印も入れられます（タコ占いは、合言葉を入れると /uranai で見られる、タイプに合わせた娯楽の占いです。スペシャルなシェア画像は、支払いの前に無料でお贈りしています）",
    ],
    [
      "価格",
      offer
        ? `${offer.tiers.map((n) => `${n.toLocaleString("ja-JP")} 円`).join("・")}（税込）から、お選びいただけます。特典の内容はどの金額でも同じです`
        : "未定",
    ],
    ["商品代金以外の必要料金", "なし（通信料はお客さまのご負担です）"],
    [
      "支払い方法",
      "クレジットカード・Apple Pay・Google Pay（Stripe の支払いのページで支払います。Apple Pay・Google Pay は対応する端末とブラウザのときに出ます）",
    ],
    [
      "支払いの時期",
      "申し込んだとき（Stripe の支払いのページで支払いを確定したとき）に、支払いが確定します",
    ],
    [
      "未成年の方のご利用",
      "18 歳未満の方は、保護者の同意を得てからお支払いください（支払いの画面にも表示しています）。保護者の同意なく申し込まれたと分かったときは、お問い合わせで確かめたうえで返金します",
    ],
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
      `特典は、その診断の保存期限（結果が出てから 180 日）まで見られます。残りの日数は、申し込みの前に表示します。保存期限まで ${MIN_PREMIUM_DAYS} 日に満たない診断では販売しません。特典を開いた診断は、結果と特典を残すため、人数をふやせません。ホストが診断を消すと、特典も見られなくなります`,
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
