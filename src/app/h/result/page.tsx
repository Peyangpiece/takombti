import type { Metadata } from "next";
import { ResultPage } from "./ResultPage";

export const metadata: Metadata = { title: "結果", robots: { index: false } };

export default function Page() {
  return <ResultPage />;
}
