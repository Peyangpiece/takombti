import type { Metadata } from "next";
import { SelfPage } from "./SelfPage";

export const metadata: Metadata = {
  title: "自己回答",
  robots: { index: false },
};

export default function Page() {
  return <SelfPage />;
}
