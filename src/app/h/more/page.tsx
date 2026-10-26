import type { Metadata } from "next";
import { MorePage } from "./MorePage";

export const metadata: Metadata = {
  title: "人数をふやす",
  robots: { index: false },
};

export default function Page() {
  return <MorePage />;
}
