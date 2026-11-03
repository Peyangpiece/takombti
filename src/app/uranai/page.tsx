import type { Metadata } from "next";
import { FortunePage } from "./FortunePage";

export const metadata: Metadata = {
  title: "タコ占い",
  description:
    "たこ診を応援してくれた人へのお礼の、タイプ別の占い。合言葉で見られます。",
  robots: { index: false },
};

export default function Page() {
  return <FortunePage />;
}
