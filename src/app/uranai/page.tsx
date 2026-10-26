import type { Metadata } from "next";
import { FortunePage } from "./FortunePage";

export const metadata: Metadata = {
  title: "裏の占い",
  description:
    "スペシャルなシェア画像の裏にかくれた、タイプ別の占い。合言葉で見られます。",
  robots: { index: false },
};

export default function Page() {
  return <FortunePage />;
}
