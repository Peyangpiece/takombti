"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { VisitSource } from "../data/sources";
// ブラウザ側の小さな道具（仕様書 §8.3）。保存領域が使えなくても画面は壊さない。

export interface SavedSurvey {
  hostKey: string;
  surveyId: string;
  nickname: string;
  createdAt: string;
}

export const SAVED_KEY = "takoshin:hosted";
// 「つくった診断」として覚えておく数の上限
export const SAVED_MAX = 100;
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
      : // 管理用の鍵の控えになるので、すぐには消さない（多すぎる端末の保存領域を守るため、上限だけ置く）
        [entry, ...list].slice(0, SAVED_MAX),
  );
}

export function forgetSurvey(hostKey: string): void {
  safeSet(
    SAVED,
    savedSurveys().filter((x) => x.hostKey !== hostKey),
  );
}

// グループ診断（仕様書 §4.15・§8.3）。参加したグループと、そのグループでの自分の管理用の鍵。
// adminKey は作った人だけ（締め切って始めるため）
export interface SavedGroup {
  groupId: string;
  hostKey: string;
  adminKey?: string;
  nickname: string;
  createdAt: string;
}

export const GROUPS_KEY = "takoshin:groups";
// グループのページから答えた診断（この端末で答えた印を出すため。サーバーからは、だれがだれに答えたかを受け取らない）
export const GROUP_ANSWERED_KEY = "takoshin:group-answered";

export function savedGroups(): SavedGroup[] {
  const v = safeGet<unknown>(GROUPS_KEY, []);
  return Array.isArray(v)
    ? (v as SavedGroup[]).filter(
        (g) =>
          g && typeof g.groupId === "string" && typeof g.hostKey === "string",
      )
    : [];
}

export function saveGroup(g: SavedGroup): boolean {
  const all = savedGroups();
  const old = all.find((x) => x.groupId === g.groupId);
  // 同じグループに別の鍵で入り直したときは、新しい鍵にする。作った人の鍵は消さない
  const entry = old
    ? { ...g, adminKey: g.adminKey ?? old.adminKey, createdAt: old.createdAt }
    : g;
  return safeSet(
    GROUPS_KEY,
    [entry, ...all.filter((x) => x.groupId !== g.groupId)].slice(0, SAVED_MAX),
  );
}

export function groupAnswered(): string[] {
  const v = safeGet<unknown>(GROUP_ANSWERED_KEY, []);
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export function markGroupAnswered(surveyId: string): void {
  const list = groupAnswered().filter((x) => x !== surveyId);
  safeSet(GROUP_ANSWERED_KEY, [surveyId, ...list].slice(0, SAVED_MAX));
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

// ページの中の見出しへ移る。管理用の鍵は URL の # の後ろにあるので、# を書きかえる移り方（<a href="#…">）は使わない。
// 書きかえると、再読み込みや新しいタブで鍵がなくなり「診断が見つかりません」になる（仕様書 §8.2）
export function scrollToId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  // 読み上げとキーボードの位置も移す
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
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
// 画像の保存の結果。shared は端末の共有の画面を開いたところまで（そこで保存したかは分からない）
export type SaveOutcome = "shared" | "downloaded" | "canceled" | "failed";

// 画像のファイルを、端末の共有の画面で渡せるか（スマホの多く）。渡せなければダウンロードにする
export function canShareImage(): boolean {
  try {
    return (
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [new File([""], "a.png", { type: "image/png" })],
      })
    );
  } catch {
    return false;
  }
}

export async function saveResultImage(
  hostKey: string,
  code: string,
  size: "story" | "wide",
  special = false,
  supporter = false,
  withSelf = false,
  // download：共有の画面を使わず、PNG のファイルとしてダウンロードする
  mode: "auto" | "download" = "auto",
): Promise<SaveOutcome> {
  let blob: Blob;
  try {
    const res = await fetch(
      `/api/host/image?size=${size}${special ? "&special=1" : ""}${supporter ? "&supporter=1" : ""}${withSelf ? "&self=1" : ""}`,
      { headers: { "x-host-key": hostKey } },
    );
    if (!res.ok) return "failed";
    blob = await res.blob();
  } catch {
    return "failed";
  }
  const file = new File(
    [blob],
    `takoshin-${code}-${special ? "special-" : ""}${size}.png`,
    { type: "image/png" },
  );
  if (mode === "auto" && canShareImage()) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      // 共有の画面を閉じただけなら、失敗とは言わない
      return e instanceof DOMException && e.name === "AbortError"
        ? "canceled"
        : "failed";
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

// 保存の結果を、ボタンの下に出す言葉にする
export function saveMessage(o: SaveOutcome): string {
  switch (o) {
    case "shared":
      return "共有の画面を開きました。「画像を保存」を選ぶと写真に入ります";
    case "downloaded":
      return "画像（PNG）をダウンロードしました";
    case "canceled":
      return "保存をやめました";
    case "failed":
      return "画像を作れませんでした。もう一度試してください";
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

// X アプリの投稿画面を、文とリンクを入れた状態で直接開く URL。
// スマホで x.com/intent/post を開くと、X アプリがそのアドレスを受け取れず、アプリの中でログインの画面を出すことがあるため
export function xAppUrl(text: string, url: string): string {
  return `twitter://post?message=${encodeURIComponent(`${text} ${url}`.trim())}`;
}

// スマホで X に投稿する：まず X アプリの投稿画面を開き、アプリが開かなかったら（入っていないなど）ウェブの投稿画面へ移る
export function openXCompose(text: string, url: string, wait = 2000): void {
  let left = false;
  const onLeave = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  const onBlur = () => {
    left = true;
  };
  document.addEventListener("visibilitychange", onLeave);
  window.addEventListener("pagehide", onBlur);
  window.location.href = xAppUrl(text, url);
  setTimeout(() => {
    document.removeEventListener("visibilitychange", onLeave);
    window.removeEventListener("pagehide", onBlur);
    if (!left) window.location.href = xShareUrl(text, url);
  }, wait);
}

// 管理用の鍵で守った画像（シェア画像の見本）を、表示できる URL にする。query が null のあいだは取りに行かない
export function useHostImage(
  hostKey: string,
  query: string | null,
): string | null {
  const [src, setSrc] = useState<{ query: string; url: string } | null>(null);
  useEffect(() => {
    if (query === null) return;
    let url: string | null = null;
    let alive = true;
    fetch(`/api/host/image?${query}`, { headers: { "x-host-key": hostKey } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b || !alive) return;
        url = URL.createObjectURL(b);
        setSrc({ query, url });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hostKey, query]);
  return src && src.query === query ? src.url : null;
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

// ダイアログ（role="dialog" aria-modal="true"）のフォーカスの扱い。開いたら中の最初のボタンに移し、
// Tab は中だけを回り、Esc で閉じ、閉じたら開く前の場所に戻す（WCAG 2.4.3）。
// 戻り値を、ダイアログの要素の ref に付ける
export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const before = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [
        ...el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((x) => x.offsetParent !== null || x === document.activeElement);
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusable();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}
