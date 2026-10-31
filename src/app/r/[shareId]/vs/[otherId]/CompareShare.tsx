"use client";
// 並べたページのシェア（§4.15）。X・LINE・コピー。公開カードのシェアと同じ形
import { useState } from "react";
import { LineShare } from "@/components/LineShare";
import {
  copyText,
  openXCompose,
  useIsMobile,
  useShareOrigin,
  withFrom,
  xShareUrl,
} from "@/lib/client";

export function CompareShare({
  path,
  names,
}: {
  path: string;
  names: [string, string];
}) {
  const origin = useShareOrigin();
  const mobile = useIsMobile();
  const [msg, setMsg] = useState<string | null>(null);
  const url = `${origin}${path}`;
  const text = `友達から見た ${names[0]} と ${names[1]}、並べてみた #たこ診`;
  return (
    <div className="stack">
      <div className="btn-row">
        <a
          className="btn x"
          href={xShareUrl(text, withFrom(url, "x"))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!mobile) return;
            e.preventDefault();
            openXCompose(text, withFrom(url, "x"));
          }}
        >
          X に投稿
        </a>
        <LineShare
          text={text}
          url={withFrom(url, "line")}
          className="btn line"
        />
      </div>
      <button
        type="button"
        className="btn secondary"
        onClick={() =>
          copyText(withFrom(url, "copy")).then((ok) =>
            setMsg(ok ? "コピーした！" : "コピーできませんでした"),
          )
        }
      >
        リンクをコピー
      </button>
      <p className="muted small">
        どちらかが公開をやめると、このページは見られなくなります。
      </p>
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
