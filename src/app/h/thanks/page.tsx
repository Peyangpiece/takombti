import type { Metadata } from "next";
import { ThanksPage } from "./ThanksPage";

export const metadata: Metadata = {
  title: "応援ありがとうございます",
  robots: { index: false },
};

export default function Page() {
  return <ThanksPage />;
}
