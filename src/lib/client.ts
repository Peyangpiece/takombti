"use client";
import { useSyncExternalStore } from "react";
import type { VisitSource } from "../data/sources";
// ブラウザ側の小さな道具（仕様書 §8.3）。保存領域が使えなくても画面は壊さない。

export interface SavedSurvey {
  hostKey: string;
  surveyId: string;
  nickname: string;
  createdAt: string;
}

export const SAVED_KEY = "takoshin:hosted";
const SAVED = SAVED_KEY;

export function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function safeSet(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 何もしない
  }
}

export function savedSurveys(): SavedSurvey[] {
  return safeGet<SavedSurvey[]>(SAVED, []);
}

export function saveSurvey(s: SavedSurvey): boolean {
  const all = savedSurveys();
  const old = all.find((x) => x.hostKey === s.hostKey);
  const list = all.filter((x) => x.hostKey !== s.hostKey);
  const entry = old ? { ...s, createdAt: old.createdAt } : s;
  return safeSet(
    SAVED,
    old
      ? all.map((x) => (x.hostKey === s.hostKey ? entry : x))
      : [entry, ...list].slice(0, 30),
  );
}

export function forgetSurvey(hostKey: string): void {
  safeSet(
    SAVED,
    savedSurveys().filter((x) => x.hostKey !== hostKey),
  );
}

// 管理用のリンクは /h#<hostKey> の形。# より後ろはサーバーに送られない（仕様書 §8.2）
export function hostKeyFromHash(): string | null {
  const key = window.location.hash.replace(/^#/, "");
  return /^[A-Za-z0-9_-]{16,64}$/.test(key) ? key : null;
}

export function hostUrl(path: string, hostKey: string): string {
  return `${window.location.origin}${path}#${hostKey}`;
}

export async function hostApi<T>(
  path: string,
  hostKey: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`/api/host${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      "x-host-key": hostKey,
      ...init.headers,
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export function vibrate(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 対応していない端末では何もしない
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // LINE などのアプリ内ブラウザでは clipboard が使えないことがあるので、古いやり方で試す
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// LINE で送る（LINE の案内：https://developers.line.biz/ja/docs/line-login/using-line-url-scheme/）
// - スマホ：line.me/R/share。LINE アプリの「送信先の選択」が開く
// - パソコン：line.me/R/share は PC 版 LINE に対応しておらず、LINE のトップに飛ぶだけ。
//   そのため、ウェブでログインして送る social-plugins.line.me の共有を使う
export function lineShareUrl(
  text: string,
  url: string,
  mobile: boolean,
): string {
  return mobile
    ? `https://line.me/R/share?text=${encodeURIComponent(`${text} ${url}`.trim())}`
    : `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function isMobileUserAgent(ua: string, maxTouchPoints = 0): boolean {
  // iPad の Safari は、パソコンの Mac を名乗るので、タッチの有無で見分ける
  return (
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (/Macintosh/.test(ua) && maxTouchPoints > 1)
  );
}

// 描くときはスマホとみなす（使う人の多く）。ブラウザで動き始めたら確かめ直す
export function useIsMobile(): boolean {
  return useClientValue(
    () => isMobileUserAgent(navigator.userAgent, navigator.maxTouchPoints),
    true,
  );
}

// 結果のシェア画像を作って、共有するか保存する（§4.12）。special はスペシャル版（§4.11）。できたら true
export async function saveResultImage(
  hostKey: string,
  code: string,
  size: "story" | "wide",
  special = false,
  supporter = false,
  withSelf = false,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/host/image?size=${size}${special ? "&special=1" : ""}${supporter ? "&supporter=1" : ""}${withSelf ? "&self=1" : ""}`,
      { headers: { "x-host-key": hostKey } },
    );
    if (!res.ok) return false;
    const blob = await res.blob();
    const file = new File(
      [blob],
      `takoshin-${code}-${special ? "special-" : ""}${size}.png`,
      { type: "image/png" },
    );
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return true;
  } catch {
    return false;
  }
}

// 送り方の目印（?from=）を付ける（仕様書 §8.1）。数えるのは送り方ごとの件数だけ
export function withFrom(url: string, from: VisitSource): string {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}from=${from}`;
}

export function xShareUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

// ブラウザだけで読める値を、サーバーで描くときは fallback として読む。
// get は同じ値なら同じものを返すこと（文字列・数値・真偽値）。

const noSubscribe = () => () => {};

export function useClientValue<T extends string | number | boolean | null>(
  get: () => T,
  fallback: T,
): T {
  return useSyncExternalStore(noSubscribe, get, () => fallback);
}

export function useOrigin(): string {
  return useClientValue(() => window.location.origin, "");
}

// 人に送るリンク（招待リンク・公開リンク）の始まり。どのアドレスで開いていても、
// 公開するアドレス（NEXT_PUBLIC_SITE_URL）があればそちらにそろえる。
// 診断はデータベースにあるので、どちらのアドレスでも開ける（仕様書 §4.5）
export function shareOrigin(
  site = process.env.NEXT_PUBLIC_SITE_URL ?? "",
  current = window.location.origin,
): string {
  try {
    const u = new URL(site);
    if (u.protocol === "https:") return u.origin;
  } catch {
    // 設定がない・形がちがうときは、いま開いているアドレス
  }
  return current;
}

export function useShareOrigin(): string {
  return useClientValue(() => shareOrigin(), "");
}

export function useStoredRaw(key: string): string | null {
  return useClientValue(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, null);
}
