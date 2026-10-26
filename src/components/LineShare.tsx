"use client";
import type { CSSProperties, ReactNode } from "react";
import { lineShareUrl, useIsMobile } from "../lib/client";

// LINE で送るボタン。text は送る文、url はいっしょに送るリンク
export function LineShare({
  text,
  url,
  className = "btn",
  style,
  children = "LINE で送る",
}: {
  text: string;
  url: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const mobile = useIsMobile();
  return (
    <a
      className={className}
      href={lineShareUrl(text, url, mobile)}
      // スマホでは新しいタブにせず、同じ画面から開く（LINE アプリに切り替わりやすいように。
      // LINE のアプリ内ブラウザでも、そのまま LINE の送信先の選択が開く）
      {...(mobile ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      style={style}
    >
      {children}
    </a>
  );
}
