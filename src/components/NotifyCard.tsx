"use client";
// 「全員そろった」の通知と、ホーム画面への追加の案内（仕様書 §4.6・§11.10）。
// 通知は本人が押したときだけ許可を求める。連絡先（メール・電話番号）は集めない。
// iPhone・iPad は、ホーム画面に追加したアプリの中でだけ通知を受け取れる（iOS 16.4 以降）。
// ホーム画面のアプリは Safari と保存場所が分かれているので、管理用リンクを持って行ってもらう
import { useEffect, useState } from "react";
import {
  copyText,
  hostApi,
  safeGet,
  safeRemove,
  safeSet,
  useClientValue,
  useOrigin,
} from "@/lib/client";
import {
  PUSH_DENIED_MESSAGE,
  PUSH_FAILED_MESSAGE,
  detectPush,
  subscribeThisDevice,
  type PushSupport,
} from "@/lib/pushClient";

const storeKey = (hostKey: string) => `takoshin:push:${hostKey}`;

export function NotifyCard({ hostKey }: { hostKey: string }) {
  const support = useClientValue<PushSupport | null>(detectPush, null);
  const saved = useClientValue(
    () => safeGet<string | null>(storeKey(hostKey), null),
    null,
  );
  const [endpoint, setEndpoint] = useState<string | null | undefined>(
    undefined,
  );
  const on = (endpoint === undefined ? saved : endpoint) !== null;

  // 端末に「オン」と覚えていても、サーバーの登録が消えていることがある
  //（結果が出て通知を送ったあと、人数をふやして受付を再開したときなど）。そのときは「オフ」に戻す
  useEffect(() => {
    if (!saved) return;
    let alive = true;
    void hostApi<{ registered?: boolean }>("/push/status", hostKey, {
      method: "POST",
      body: JSON.stringify({ endpoint: saved }),
    })
      .then((r) => {
        if (alive && r.ok && r.data.registered === false) {
          safeRemove(storeKey(hostKey));
          setEndpoint(null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [saved, hostKey]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);

  if (support === null || support === "unsupported") return null;

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      // 許可を求めるのは、押したその場で（先に待ちを入れると、iPhone では許可の画面が出ない）
      const sub = await subscribeThisDevice();
      if (sub === "denied") {
        setMessage(PUSH_DENIED_MESSAGE);
        return;
      }
      const r = await hostApi<{ status: string }>("/push", hostKey, {
        method: "POST",
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!r.ok) {
        setMessage(
          r.data.status === "full"
            ? "この診断に通知を受け取る端末は、もう上限まで登録されています"
            : PUSH_FAILED_MESSAGE,
        );
        return;
      }
      safeSet(storeKey(hostKey), sub.endpoint);
      setEndpoint(sub.endpoint);
    } catch {
      setMessage(PUSH_FAILED_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const current = endpoint ?? saved;
    await hostApi("/push", hostKey, {
      method: "DELETE",
      body: JSON.stringify({ endpoint: current }),
    }).catch(() => null);
    safeRemove(storeKey(hostKey));
    setEndpoint(null);
    setBusy(false);
  }

  if (support === "ios-browser") {
    const url = origin ? `${origin}/h#${hostKey}` : "";
    return (
      <section className="card stack">
        <b>そろったら通知で知らせる</b>
        <p className="small">
          iPhone・iPad では、たこ診をホーム画面に追加すると通知を受け取れます。
        </p>
        {/* 手順は長いので、たたんでおく（ほかの欄が下に押しやられないように） */}
        <details className="notify-howto">
          <summary className="small">iPhone で通知を受け取る方法</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
              <li>下のボタンで管理用リンクをコピー</li>
              <li>
                Safari の共有ボタン（□に↑）→「ホーム画面に追加」（LINE
                の中で開いているときは、先に Safari で開く）
              </li>
              <li>
                ホーム画面のたこ診を開き、「管理用リンクから開く」に貼り付ける
              </li>
              <li>開いた画面で「通知を受け取る」を押す</li>
            </ol>
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
        </details>
      </section>
    );
  }

  return (
    <section className="card stack">
      <b>そろったら通知で知らせる</b>
      {support === "denied" ? (
        <p className="small">
          この端末では、たこ診の通知が止められています。端末やブラウザの設定で許可すると使えます。
        </p>
      ) : on ? (
        <>
          <p className="small">
            この端末に通知します。全員が答えたら 1 回だけ届きます。
          </p>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => void disable()}
            disabled={busy}
          >
            通知をやめる
          </button>
        </>
      ) : (
        <>
          <p className="small">
            全員が答えたら、この端末に 1
            回だけ知らせます。メールや電話番号は要りません。
          </p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => void enable()}
            disabled={busy}
          >
            {busy ? "設定しています…" : "通知を受け取る"}
          </button>
        </>
      )}
      {message && (
        <p className="error small" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}

// 答えた友達の「結果が出たら知らせてもらう」（仕様書 §4.10・§11.10）。回答を受け付けたあとの画面にだけ出す。
// 回答者の鍵（cookie）で、答えた人だけが登録できる。結果そのものは届かない（見られるのは作った人だけ）。
// iPhone・iPad の Safari のままでは通知を受け取れず、ホーム画面のアプリは Safari と保存場所（cookie）が
// 分かれていて答えた人だと確かめられないので、そのときは出さない
export function ResultNotifyCard({
  surveyId,
  nickname,
}: {
  surveyId: string;
  nickname: string;
}) {
  const support = useClientValue<PushSupport | null>(detectPush, null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (
    support === null ||
    support === "unsupported" ||
    support === "ios-browser"
  )
    return null;

  const api = (method: "POST" | "DELETE", body: unknown) =>
    fetch(`/api/surveys/${surveyId}/push`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const sub = await subscribeThisDevice();
      if (sub === "denied") {
        setMessage(PUSH_DENIED_MESSAGE);
        return;
      }
      const res = await api("POST", { subscription: sub.toJSON() });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
        };
        setMessage(
          data.status === "not_open"
            ? "この診断はもう結果が出たか、受付が終わっています"
            : data.status === "rate_limited"
              ? "短い時間に何度も送られています。しばらくしてから試してください"
              : PUSH_FAILED_MESSAGE,
        );
        return;
      }
      setEndpoint(sub.endpoint);
    } catch {
      setMessage(PUSH_FAILED_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    await api("DELETE", { endpoint }).catch(() => null);
    setEndpoint(null);
    setBusy(false);
  }

  return (
    <section className="card stack">
      <b>結果が出たら知らせてもらう</b>
      {support === "denied" ? (
        <p className="small">
          この端末では、たこ診の通知が止められています。端末やブラウザの設定で許可すると使えます。
        </p>
      ) : endpoint ? (
        <>
          <p className="small">
            この端末に、みんなの答えがそろったら 1 回だけ通知します。
          </p>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => void disable()}
            disabled={busy}
          >
            通知をやめる
          </button>
        </>
      ) : (
        <>
          <p className="small">
            みんなの答えがそろったら、通知でお知らせします（結果を見られるのは{" "}
            {nickname} だけです）。メールや電話番号は要りません。
          </p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => void enable()}
            disabled={busy}
          >
            {busy ? "設定しています…" : "通知を受け取る"}
          </button>
        </>
      )}
      {message && (
        <p className="error small" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
