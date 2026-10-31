// 流入から診断の完成までの計測（仕様書 §11.11）で使う、決まった値の一覧。画面とサーバーで共用する。
// ここにない値は記録しない（自由な文字列を入れさせない）

// 流入元。リンクの ?from=（たこ診が付ける目印）・?utm_source=・アプリ内ブラウザー・前のページのアドレスから決める
export const ORIGINS = [
  { id: "line", label: "LINE" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X" },
  { id: "qr", label: "QR コード" },
  { id: "copy", label: "コピーしたリンク" },
  { id: "share", label: "端末の共有" },
  { id: "search", label: "検索" },
  { id: "other", label: "ほかのサイト" },
  { id: "none", label: "直接／不明" },
] as const;

export type Origin = (typeof ORIGINS)[number]["id"];

export function isOrigin(v: unknown): v is Origin {
  return ORIGINS.some((o) => o.id === v);
}

// 投稿ごとに比べるときのキャンペーンの目印（?c=）。運営者がここに足したものだけを記録する。
// 例：{ id: "ig-2026-11-a", label: "Instagram 11 月の投稿 A" }
export const CAMPAIGNS: readonly { id: string; label: string }[] = [];

export function isCampaign(v: unknown): v is string {
  return typeof v === "string" && CAMPAIGNS.some((c) => c.id === v);
}

// 診断を作った入口。作成画面のアドレスの ?entry= で受け取る
export const ENTRIES = [
  { id: "thanks", label: "回答完了の画面" },
  { id: "public", label: "公開カード" },
  { id: "notify", label: "答えた人への「結果が出ました」の通知" },
  { id: "top", label: "トップ" },
  { id: "types", label: "16 タイプの紹介" },
  // グループ診断（§4.15）で、始めたときにメンバーごとに作った診断
  { id: "group", label: "グループで一斉に" },
  { id: "none", label: "そのほか・不明" },
] as const;

export type Entry = (typeof ENTRIES)[number]["id"];

export function isEntry(v: unknown): v is Entry {
  return ENTRIES.some((e) => e.id === v);
}

// 画面から送る出来事と、その内訳として受け付ける値。
// 作成の成功・回答の受理・完成・結果の表示・公開リンクの作成は、サーバーの処理が成功したときにサーバーで数える
export const CLIENT_EVENTS = {
  // 作成画面を開いた（内訳：流入元）
  create_view: ORIGINS.map((o) => o.id),
  // 招待の操作（内訳：送り方）。押したことだけで、実際に送ったかは分からない。
  // remind_*：回答状況の画面の「まだの人に、もう一度送る」（§4.6）
  invite: [
    "line",
    "copy_text",
    "copy_link",
    "share",
    "qr",
    "remind_line",
    "remind_copy",
  ],
  // 回答を始めた（内訳：その招待リンクの送り方）。同じ端末・同じ診断は 1 回だけ
  answer_start: ORIGINS.map((o) => o.id),
  // 回答にかかった時間（内訳：時間の区切り）。所要時間の目安を実測で見直すため
  answer_time: ["lt3", "3to6", "6to10", "ge10"],
  // 画像の保存・共有の操作（内訳：画像の種類と、共有の画面を開いたかダウンロードしたか）
  image: ["story_shared", "story_downloaded", "wide_shared", "wide_downloaded"],
  // 結果を X・LINE で送る操作（押したことだけ）
  result_share: ["x", "line"],
} as const;

export type ClientEvent = keyof typeof CLIENT_EVENTS;

export function isClientEvent(
  event: unknown,
  key: unknown,
): event is ClientEvent {
  if (typeof event !== "string" || !Object.hasOwn(CLIENT_EVENTS, event))
    return false;
  return (CLIENT_EVENTS[event as ClientEvent] as readonly string[]).includes(
    String(key),
  );
}

// サーバーで数える出来事
export type ServerEvent =
  | "created"
  | "response"
  | "completed"
  | "result_view"
  | "public_created"
  | "group";

// サーバーで、処理と同じトランザクションの中で funnel_counts に数える出来事と、その内訳。
// group：グループ診断（§4.15）の作成・参加・開始の件数（どのグループかは残さない）
export const SERVER_COUNTED = {
  group: ["created", "joined", "started"],
} as const;

// 集計の表に出す出来事
export type FunnelEventLabel = ClientEvent | ServerEvent;

// 回答にかかった時間（秒）を区切りにする
export function answerTimeBucket(seconds: number): string {
  if (seconds < 180) return "lt3";
  if (seconds < 360) return "3to6";
  if (seconds < 600) return "6to10";
  return "ge10";
}
