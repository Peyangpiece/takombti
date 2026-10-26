"use client";
// 招待リンクの共有（仕様書 §4.5）
import { useState } from "react";
import QRCode from "qrcode";
import {
  copyText,
  lineShareUrl,
  useClientValue,
  useOrigin,
} from "../lib/client";

export function inviteMessage(url: string): string {
  return `わたしについて答えて！友達から見た 16 タイプがわかるらしい。3 分・匿名だよ → ${url}`;
}

export function InviteShare({ surveyId }: { surveyId: string }) {
  const origin = useOrigin();
  const url = origin ? `${origin}/a/${surveyId}` : "";
  const canShare = useClientValue(
    () => typeof navigator.share === "function",
    false,
  );
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const text = inviteMessage(url);
  return (
    <div className="stack">
      <div className="linkbox">
        <span style={{ flex: 1 }}>{url}</span>
      </div>
      <a
        className="btn"
        href={lineShareUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ background: "#06C755", color: "#fff" }}
      >
        LINE で送る
      </a>
      <div className="btn-row">
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            setCopied(await copyText(text));
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "コピーした！" : "コピー"}
        </button>
        {canShare ? (
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              navigator.share({ text: inviteMessage(""), url }).catch(() => {})
            }
          >
            その他
          </button>
        ) : (
          <button
            type="button"
            className="btn secondary"
            onClick={async () =>
              setQr(
                qr
                  ? null
                  : await QRCode.toDataURL(url, { margin: 1, width: 440 }),
              )
            }
          >
            QR コード
          </button>
        )}
      </div>
      {canShare && (
        <button
          type="button"
          className="btn ghost"
          onClick={async () =>
            setQr(
              qr
                ? null
                : await QRCode.toDataURL(url, { margin: 1, width: 440 }),
            )
          }
        >
          {qr ? "QR コードを閉じる" : "QR コードを出す"}
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img className="qr" src={qr} alt="招待リンクの QR コード" />}
      <p className="muted small" aria-live="polite">
        コピーすると、送る文といっしょに入ります。
      </p>
    </div>
  );
}

// 管理用のリンクを保存してもらう（仕様書 §4.5）
export function KeepHostLink({ hostKey }: { hostKey: string }) {
  const origin = useOrigin();
  const url = origin ? `${origin}/h#${hostKey}` : "";
  const [copied, setCopied] = useState(false);
  const msg = `たこ診の管理用リンク（自分だけ用・人に送らない）→ ${url}`;
  return (
    <div className="notice stack">
      <p>
        <b>管理用のリンクは自分だけのもの。</b>
        なくすと結果を見られないので、自分あてに保存しておこう。
      </p>
      <div className="btn-row">
        <a
          className="btn secondary"
          href={lineShareUrl(msg)}
          target="_blank"
          rel="noopener noreferrer"
        >
          自分に送っておく
        </a>
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            setCopied(await copyText(url));
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "コピーした！" : "リンクをコピー"}
        </button>
      </div>
    </div>
  );
}
