import type { Metadata } from "next";
import { INQUIRY_KINDS } from "@/data/inquiry";
import { SITE_URL } from "@/lib/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "お問い合わせ" };

// 回答の画面の「報告」から来たときは、種類と対象の診断を選んだ状態で開く（?kind=abuse&survey=<ID>）
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = await searchParams;
  const kind = INQUIRY_KINDS.find((k) => k.id === q.kind)?.id ?? null;
  const survey =
    typeof q.survey === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(q.survey)
      ? q.survey
      : null;
  return (
    <ContactForm
      initialKind={kind}
      initialSurveyRef={survey ? `${SITE_URL}/a/${survey}` : ""}
    />
  );
}
