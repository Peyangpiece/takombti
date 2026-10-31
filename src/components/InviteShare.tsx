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
import { track } from "../lib/track";
import { ANSWER_TIME_LABEL } from "../data/questions";

// 招待の文（§4.5）。友達が安心して答えられるよう、何のための診断か・かかる時間・登録なし・
// だれが何と答えたかは作った人に見えないこと・何人そろったら結果が出るかを入れる。
// もう答えてくれた人がいるときは（送り直し）、その人へのお礼を先に入れる
export function inviteMessage(
  url: string,
  targetCount: number,
  answered = 0,
): string {
  const thanks =
    answered > 0 ? "もう答えてくれた人はありがとう！ まだの人は、" : "";
  const time = ANSWER_TIME_LABEL.replace(/\s/g, "");
  const body = `${thanks}私って周りからどう見えてるか知りたいので、答えてほしい！ ${time}・登録なし。1人ずつの答えは私には表示されません。${targetCount}人そろったら結果が出るので、出たら見せるね。`;
  return url ? `${body}\n${url}` : body;
}

// まだ答えていない人への、もう一度のお願いの文（§4.6）。あと何人で結果が出るかを入れる。
// だれが答えたかは作った人にも分からないので、「まだの人は」とだけ書き、みんなに送れる形にする
export function remindMessage(
  url: string,
  nickname: string,
  remaining: number,
): string {
  const time = ANSWER_TIME_LABEL.replace(/^約\s*/, "").replace(/\s/g, "");
  const body = `${nickname}の他己診断、あと${remaining}人で結果が出ます！ まだの人はここから（匿名・${time}）`;
  return url ? `${body}\n${url}` : body;
}

// 回答状況の画面の「まだの人に、もう一度送る」（§4.6）。LINE で送るか、文をコピーする
export function RemindShare({
  surveyId,
  nickname,
  remaining,
}: {
  surveyId: string;
  nickname: string;
  remaining: number;
}) {
  const origin = useShareOrigin();
  const url = origin ? `${origin}/a/${surveyId}` : "";
  const [copied, setCopied] = useState(false);
  const text = remindMessage("", nickname, remaining);
  return (
    <section className="card stack">
      <b>まだの人に、もう一度送る</b>
      <p className="invite-preview">
        {text}
        <br />
        <span className="invite-preview-url">{url}</span>
      </p>
      <p className="muted small">
        だれが答えたかは表示されないので、前に送ったグループや相手に、そのまま送れます。
      </p>
      <LineShare
        text={text}
        url={withFrom(url, "line")}
        className="btn line"
        onUse={() => track("invite", "remind_line")}
      />
      <button
        type="button"
        className="btn secondary"
        onClick={async () => {
          track("invite", "remind_copy");
          if (
            await copyText(
              remindMessage(withFrom(url, "copy"), nickname, remaining),
            )
          ) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        {copied ? "コピーした！" : "文をコピー"}
      </button>
    </section>
  );
}

export function InviteShare({
  surveyId,
  targetCount,
  answered = 0,
}: {
  surveyId: string;
  targetCount: number;
  answered?: number;
}) {
  const origin = useShareOrigin();
  const url = origin ? `${origin}/a/${surveyId}` : "";
  const canShare = useClientValue(
    () => typeof navigator.share === "function",
    false,
  );
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const text = inviteMessage("", targetCount, answered);

  async function copy(kind: "text" | "link") {
    track("invite", kind === "text" ? "copy_text" : "copy_link");
    const link = withFrom(url, "copy");
    if (
      await copyText(
        kind === "text" ? inviteMessage(link, targetCount, answered) : link,
      )
    ) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  async function toggleQr() {
    if (!qr) track("invite", "qr");
    setQr(
      qr
        ? null
        : await QRCode.toDataURL(withFrom(url, "qr"), {
            margin: 1,
            width: 440,
          }),
    );
  }

  // 送り方ごとに目印を付けたリンク。画面に見せるリンクは目印なし
  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}>
        <p className="muted small">送る文の見本</p>
        <p className="invite-preview">
          {text}
          <br />
          <span className="invite-preview-url">{url}</span>
        </p>
      </div>
      <LineShare
        text={text}
        url={withFrom(url, "line")}
        className="btn line"
        onUse={() => track("invite", "line")}
      />
      <div className="btn-row">
        <button
          type="button"
          className="btn secondary tight"
          onClick={() => void copy("text")}
        >
          {copied === "text" ? "コピーした！" : "文章＋リンクをコピー"}
        </button>
        <button
          type="button"
          className="btn secondary tight"
          onClick={() => void copy("link")}
        >
          {copied === "link" ? "コピーした！" : "リンクだけコピー"}
        </button>
      </div>
      {canShare && (
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            track("invite", "share");
            // 閉じても（キャンセルしても）診断には何も起きない
            navigator
              .share({ text, url: withFrom(url, "share") })
              .catch(() => {});
          }}
        >
          ほかのアプリで送る
        </button>
      )}
      <button
        type="button"
        className="btn ghost"
        onClick={() => void toggleQr()}
      >
        {qr ? "QR コードを閉じる" : "QR コードを出す"}
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img className="qr" src={qr} alt="招待リンクの QR コード" />}
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
