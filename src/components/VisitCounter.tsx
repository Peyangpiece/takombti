"use client";
// 招待リンク・公開リンクが開かれたことを、送り方（?from=）ごとに数える（仕様書 §8.1）。
// 送るのはページの種類と送り方だけ。数えたあとは、アドレスから ?from= を外す
//（そのアドレスをコピーして送り直したときに、元の送り方として数えないように）
import { useEffect } from "react";
import type { VisitPage } from "@/data/sources";
import { captureOrigin, rememberArrival } from "@/lib/track";

const counted = new Set<string>();

export function VisitCounter({ page }: { page: VisitPage }) {
  useEffect(() => {
    // ?from= を外す前に、流入元として覚えておく（§11.11）
    captureOrigin();
    rememberArrival();
    const url = new URL(window.location.href);
    const from = url.searchParams.get("from");
    // トップは、目印があるとき（結果のシェアから来たとき）だけ数える
    if (page === "top" && !from) return;
    const key = `${page}|${url.pathname}`;
    if (counted.has(key)) return;
    counted.add(key);
    fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page, from }),
      keepalive: true,
    }).catch(() => {});
    if (from) {
      url.searchParams.delete("from");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [page]);
  return null;
}
