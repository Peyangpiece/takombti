import { json } from "@/lib/http";

// グループ診断を新しく作るのは終わった（仕様書 §4.16）。いまあるグループは、期限まで参加・開始・回答ができる
export async function POST() {
  return json({ error: "ended" }, 410);
}
