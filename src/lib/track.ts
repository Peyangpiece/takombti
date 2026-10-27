"use client";
// 画面での操作の計測（仕様書 §11.11）。決まった出来事と内訳だけを /api/event に送る。
// 呼び名・回答・診断の ID・管理用の鍵は送らない。外部の解析サービスは使わない
import {
  CAMPAIGNS,
  isCampaign,
  isOrigin,
  type ClientEvent,
  type Origin,
} from "@/data/funnel";
import { safeGet, safeRemove, safeSet } from "./client";

const ORIGIN_KEY = "takoshin:origin";
const TESTER_KEY = "takoshin:tester";
// 流入元を覚えておく日数（来た日に作らず、あとで作る人もいるため）
const KEEP_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

interface Stored {
  origin: Origin;
  campaign: string | null;
  at: number;
}

const FROM_MAP: Record<string, Origin> = {
  line: "line",
  x: "x",
  qr: "qr",
  copy: "copy",
  share: "share",
  instagram: "instagram",
  ig: "instagram",
  tiktok: "tiktok",
  twitter: "x",
};

// アドレスの目印（?from= と ?utm_source=）から
export function originFromParams(params: URLSearchParams): Origin | null {
  for (const name of ["from", "utm_source"]) {
    const v = params.get(name)?.toLowerCase();
    if (v && FROM_MAP[v]) return FROM_MAP[v];
  }
  return null;
}

// アプリの中のブラウザー（Instagram・TikTok・LINE・X のアプリで開いたとき）から
export function originFromUserAgent(ua: string): Origin | null {
  if (/Instagram/.test(ua)) return "instagram";
  if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) return "tiktok";
  if (/\bLine\//i.test(ua)) return "line";
  if (/Twitter/i.test(ua)) return "x";
  return null;
}

// 前のページのアドレス（ほかのサイトから来たとき）から
export function originFromReferrer(
  referrer: string,
  ownHost: string,
): Origin | null {
  let host: string;
  try {
    host = new URL(referrer).hostname;
  } catch {
    return null;
  }
  if (!host || host === ownHost) return null;
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)(x\.com|twitter\.com|t\.co)$/.test(host)) return "x";
  if (/(^|\.)line\.me$/.test(host)) return "line";
  if (/(^|\.)(google\.[a-z.]+|bing\.com|yahoo\.co\.jp|yahoo\.com)$/.test(host))
    return "search";
  return "other";
}

// ページを開いたときに呼ぶ。アドレスの目印は、前に覚えた流入元より優先する。
// 目印がなければ、まだ何も覚えていないときだけ、アプリの中のブラウザーや前のページのアドレスから決める
export function captureOrigin(): void {
  try {
    const url = new URL(window.location.href);
    const explicit = originFromParams(url.searchParams);
    const c = url.searchParams.get("c");
    const campaign = isCampaign(c) ? c : null;
    const now = Date.now();
    const stored = safeGet<Stored | null>(ORIGIN_KEY, null);
    const fresh = stored && now - stored.at < KEEP_DAYS * DAY;
    if (explicit || campaign) {
      safeSet(ORIGIN_KEY, {
        origin: explicit ?? stored?.origin ?? "none",
        campaign: campaign ?? (fresh ? stored!.campaign : null),
        at: now,
      } satisfies Stored);
      return;
    }
    if (fresh) return;
    const implicit =
      originFromUserAgent(navigator.userAgent) ??
      originFromReferrer(document.referrer, window.location.hostname) ??
      "none";
    safeSet(ORIGIN_KEY, {
      origin: implicit,
      campaign: null,
      at: now,
    } satisfies Stored);
  } catch {
    // 数えられなくても画面には関係ない
  }
}

export function currentOrigin(): { origin: Origin; campaign: string | null } {
  const s = safeGet<Stored | null>(ORIGIN_KEY, null);
  if (!s || Date.now() - s.at >= KEEP_DAYS * DAY || !isOrigin(s.origin))
    return { origin: "none", campaign: null };
  return {
    origin: s.origin,
    campaign:
      s.campaign && CAMPAIGNS.some((x) => x.id === s.campaign)
        ? s.campaign
        : null,
  };
}

// このページをどの送り方で開いたか（招待リンクの回答者の内訳。§11.11）。
// 作った人の流入元（7 日覚える）とは別に、開いたそのときの目印（?from=）か、アプリの中のブラウザーだけで決める
const arrivalKey = (path: string) => `takoshin:arrival:${path}`;

export function rememberArrival(): void {
  try {
    const url = new URL(window.location.href);
    const origin =
      originFromParams(url.searchParams) ??
      originFromUserAgent(navigator.userAgent) ??
      "none";
    // 目印を外したあとの読み直しでは、最初に開いたときの値を残す
    if (
      origin === "none" &&
      window.sessionStorage.getItem(arrivalKey(url.pathname))
    )
      return;
    window.sessionStorage.setItem(arrivalKey(url.pathname), origin);
  } catch {
    // 数えられなくても画面には関係ない
  }
}

export function arrivalOrigin(): Origin {
  try {
    const v = window.sessionStorage.getItem(
      arrivalKey(window.location.pathname),
    );
    return isOrigin(v) ? v : "none";
  } catch {
    return "none";
  }
}

// 運営・開発のテストに使う端末か（/admin で切りかえる）。テストの操作は集計から外せる
export function isTester(): boolean {
  return safeGet<string | null>(TESTER_KEY, null) === "1";
}

export function setTester(on: boolean): void {
  if (on) safeSet(TESTER_KEY, "1");
  else safeRemove(TESTER_KEY);
}

export function track(event: ClientEvent, key: string): void {
  try {
    void fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, key, test: isTester() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 数えられなくても画面には関係ない
  }
}
