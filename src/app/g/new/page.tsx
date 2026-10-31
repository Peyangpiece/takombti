import type { Metadata } from "next";
import { GroupNewForm } from "./GroupNewForm";

export const metadata: Metadata = {
  title: "グループでいっせいに",
  description:
    "友達どうしで、おたがいのことを答えあう他己診断。みんなに「周りから見たあなた」が届きます。",
};

export default function Page() {
  return <GroupNewForm />;
}
