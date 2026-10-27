"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { copyText, lineShareUrl, useIsMobile } from "../lib/client";

// LINE で送るボタン。text は送る文、url はいっしょに送るリンク。
// スマホ：LINE アプリの送信先の選択を開く。
// パソコン：PC 版 LINE のアプリを文つきで開く方法を LINE が用意していないので、
// 文とリンクをコピーし、PC 版 LINE のトークに貼り付けてもらう。ブラウザの LINE で送る道も残す
export function LineShare({
  text,
  url,
  className = "btn",
  style,
  children = "LINE で送る",
  onUse,
}: {
  text: string;
  url: string;
  // 押したとき（計測。§11.11）
  onUse?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const mobile = useIsMobile();
  const [copied, setCopied] = useState<boolean | null>(null);

  if (mobile)
    return (
      <a
        className={className}
        href={lineShareUrl(text, url, true)}
        onClick={onUse}
        // 新しいタブにせず、同じ画面から開く（LINE アプリに切り替わりやすいように。
        // LINE のアプリ内ブラウザでも、そのまま LINE の送信先の選択が開く）
        style={style}
      >
        {children}
      </a>
    );

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={async () => {
          onUse?.();
          setCopied(await copyText(`${text} ${url}`.trim()));
        }}
      >
        {children}
      </button>
      {copied !== null && (
        <p className="small" role="status" style={{ width: "100%", margin: 0 }}>
          {copied
            ? "コピーしました。PC 版 LINE のトークに貼り付けて送ってください。"
            : "コピーできませんでした。"}{" "}
          <a
            href={lineShareUrl(text, url, false)}
            target="_blank"
            rel="noopener noreferrer"
          >
            ブラウザの LINE で送る
          </a>
        </p>
      )}
    </>
  );
}
