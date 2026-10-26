import type { Metadata } from "next";
import { AdminPage } from "./AdminPage";

export const metadata: Metadata = {
  title: "運営者のページ",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminPage />;
}
