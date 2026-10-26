import type { Metadata } from "next";
import { NewForm } from "./NewForm";

export const metadata: Metadata = { title: "診断をつくる" };

export default function Page() {
  return <NewForm />;
}
