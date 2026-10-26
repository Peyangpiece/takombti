import type { Metadata } from "next";
import { SharePage } from "./SharePage";

export const metadata: Metadata = {
  title: "招待リンクを送る",
  robots: { index: false },
};

export default function Page() {
  return <SharePage />;
}
