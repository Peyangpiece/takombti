import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "お問い合わせ" };

export default function Page() {
  return <ContactForm />;
}
