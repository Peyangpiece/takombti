"use client";
// ブラウザの通知の登録（仕様書 §11.10）。作った人の「そろったら通知」（NotifyCard）と、
// 答えた友達の「結果が出たら知らせてもらう」（ResultNotifyCard）で共用する。
// iPhone・iPad は、ホーム画面に追加したアプリの中でだけ通知を受け取れる（iOS 16.4 以降）

export type PushSupport = "ready" | "ios-browser" | "unsupported" | "denied";

export function detectPush(): PushSupport {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iP(hone|ad|od)/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true;
  const can =
    "serviceWorker" in nav &&
    "PushManager" in window &&
    "Notification" in window;
  if (ios && !standalone) return "ios-browser";
  if (!can) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const t = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// この端末の購読を作る（あればそれを使う）。押したその場で呼ぶ
//（先に待ちを入れると、iPhone では許可の画面が出ない）。許可されなければ "denied"
export async function subscribeThisDevice(): Promise<
  PushSubscription | "denied"
> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const { publicKey } = (await fetch("/api/push/key").then((r) =>
    r.json(),
  )) as { publicKey: string };
  return (
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }))
  );
}

export const PUSH_DENIED_MESSAGE =
  "通知が許可されませんでした。端末の設定でたこ診の通知を許可すると使えます";
export const PUSH_FAILED_MESSAGE =
  "うまくいきませんでした。もう一度試してください";
