"use client";
// 招待リンクの共有（仕様書 §4.5）
import { useState } from "react";
import QRCode from "qrcode";
import {
  copyText,
  useClientValue,
  useOrigin,
  useShareOrigin,
  withFrom,
} from "../lib/client";
import { LineShare } from "./LineShare";

export function inviteMessage(url: string): string {
  return `わたしについて答えて！友達から見た 16 タイプがわかるらしい。3 分・匿名だよ → ${url}`;
}

export function InviteShare({ surveyId }: { surveyId: string }) {
  const origin = useShareOrigin();
  const url = origin ? `${origin}/a/${surveyId}` : "";
  const canShare = useClientValue(
    () => typeof navigator.share === "function",
    false,
  );
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  // 送り方ごとに目印を付けたリンク。画面に見せるリンクは目印なし
  const qrUrl = withFrom(url, "qr");
  return (
    <div className="stack">
      <div className="linkbox">
        <span style={{ flex: 1 }}>{url}</span>
      </div>
      <LineShare
        text={inviteMessage("").trimEnd()}
        url={withFrom(url, "line")}
        style={{ background: "#06C755", color: "#fff" }}
      />
      <div className="btn-row">
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            setCopied(await copyText(inviteMessage(withFrom(url, "copy"))));
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
              navigator
                .share({ text: inviteMessage(""), url: withFrom(url, "share") })
                .catch(() => {})
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
                  : await QRCode.toDataURL(qrUrl, { margin: 1, width: 440 }),
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
                : await QRCode.toDataURL(qrUrl, { margin: 1, width: 440 }),
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

// 管理用のリンクを保存してもらう（仕様書 §4.5）。
// 「つくった診断」の一覧はアドレスごとに端末に残るので、管理用のリンクはいま開いているアドレスのまま
export function KeepHostLink({ hostKey }: { hostKey: string }) {
  const origin = useOrigin();
  const url = origin ? `${origin}/h#${hostKey}` : "";
  const [copied, setCopied] = useState(false);
  const msg = "たこ診の管理用リンク（自分だけ用・人に送らない）→";
  return (
    <div className="notice stack">
      <p>
        <b>管理用のリンクは自分だけのもの。</b>
        なくすと結果を見られないので、自分あてに保存しておこう。
      </p>
      {/* 友達に送るリンクと取り違えないよう、横に並べず、名前を長めにする */}
      <div className="stack">
        <LineShare text={msg} url={url} className="btn secondary">
          自分の LINE に送る
        </LineShare>
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            setCopied(await copyText(url));
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "コピーした！" : "管理用リンクをコピー"}
        </button>
      </div>
    </div>
  );
}
