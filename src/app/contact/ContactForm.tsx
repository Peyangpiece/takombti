"use client";
// 問い合わせ（プライバシーポリシーの窓口）。届いた内容は運営者だけが /admin で読む

import Link from "next/link";
import { useState } from "react";
import { Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { BODY_MAX, INQUIRY_KINDS, type InquiryKind } from "@/data/inquiry";
import { charLength } from "@/lib/text";

const ERRORS: Record<string, string> = {
  bad_kind: "お問い合わせの種類を選んでください",
  empty: "内容を書いてください",
  too_long: "長すぎます。短くしてください",
  rate_limited:
    "送信が多すぎます。1 時間ほどたってから、もう一度送ってください",
};

export function ContactForm() {
  const [kind, setKind] = useState<InquiryKind | null>(null);
  const [body, setBody] = useState("");
  const [surveyRef, setSurveyRef] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const len = charLength(body.trim());
  const valid = kind !== null && len > 0 && len <= BODY_MAX;
  const hostLinkPasted = surveyRef.includes("#");

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, body, surveyRef, replyTo, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) setSent(true);
      else
        setError(
          ERRORS[data.error ?? ""] ??
            "送れませんでした。もう一度試してください",
        );
    } catch {
      setError(
        "通信できませんでした。電波のよいところでもう一度試してください",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="page stack center">
        <Header />
        <div style={{ paddingTop: 32 }} className="stack">
          <Octopus code="ISFJ" size={140} />
          <h1>送りました</h1>
          <p>お問い合わせありがとうございます。内容を確認します。</p>
          <p className="muted small">
            返信は、連絡先を書いていただいた場合で、必要なときだけお送りします。
          </p>
          <Link href="/" className="btn secondary">
            トップへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>お問い合わせ</h1>
      <p className="muted small">
        たこ診 運営事務局への窓口です。送った内容は運営者だけが読みます。
      </p>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) void send();
        }}
      >
        <div className="card stack">
          <div className="label" id="kind-label" style={{ marginBottom: 0 }}>
            お問い合わせの種類
          </div>
          <div
            className="choice-list"
            role="group"
            aria-labelledby="kind-label"
          >
            {INQUIRY_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="choice"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {(kind === "abuse" || kind === "data") && (
          <div className="card stack">
            <label
              className="label"
              htmlFor="survey-ref"
              style={{ marginBottom: 0 }}
            >
              対象の診断の招待リンク（わかれば）
            </label>
            <input
              id="survey-ref"
              className="input"
              value={surveyRef}
              onChange={(e) => setSurveyRef(e.target.value)}
              placeholder="https://…/a/…"
              inputMode="url"
              autoComplete="off"
            />
            <p className="muted small">
              「/a/」が入ったリンクです。管理用のリンク（「#」が入ったもの）は書かないでください。
            </p>
            {hostLinkPasted && (
              <p className="error">
                「#」より後ろは管理用の鍵なので、送るときに取り除きます。
              </p>
            )}
          </div>
        )}

        <div className="card stack">
          <label className="label" htmlFor="body" style={{ marginBottom: 0 }}>
            内容
          </label>
          <textarea
            id="body"
            className="input"
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="できるだけ具体的に書いてください"
            style={{ resize: "vertical", lineHeight: 1.6 }}
          />
          <p className={len > BODY_MAX ? "error" : "muted small"}>
            {len}/{BODY_MAX} 文字
          </p>
        </div>

        <div className="card stack">
          <label
            className="label"
            htmlFor="reply-to"
            style={{ marginBottom: 0 }}
          >
            返信が必要な場合の連絡先（任意）
          </label>
          <input
            id="reply-to"
            className="input"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="メールアドレスなど"
            autoComplete="email"
          />
          <p className="muted small">
            書いた場合は、返信のためだけに使い、受け付けてから 180
            日で消します。
          </p>
        </div>

        {/* 人には見えない欄（機械による送信を見分けるため） */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -9999,
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
          <label>
            website
            <input
              tabIndex={-1}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small center">
          送ると、<a href="/privacy">プライバシーポリシー</a>
          に同意したことになります。
        </p>
        <div className="bottom-bar">
          <button type="submit" className="btn" disabled={!valid || busy}>
            {busy ? "送っています…" : "送る"}
          </button>
        </div>
      </form>
    </main>
  );
}
