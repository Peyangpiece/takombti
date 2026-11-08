import type { Metadata } from "next";
import { SelfPage } from "./SelfPage";

export const metadata: Metadata = {
  title: "自分でも答える",
  robots: { index: false },
};

export default function Page() {
  return <SelfPage />;
}
