import type { Metadata } from "next";
import { StatusPage } from "./StatusPage";

export const metadata: Metadata = {
  title: "回答状況",
  robots: { index: false },
};

export default function Page() {
  return <StatusPage />;
}
