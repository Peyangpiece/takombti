"use client";
// 運営者のページ。合言葉（ADMIN_TOKEN）を入れると、問い合わせを読み、報告された診断を消せる。
// 合言葉はこのタブの中だけに覚える（タブを閉じると忘れる）

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Shell";
import { INQUIRY_KINDS } from "@/data/inquiry";
import type { Inquiry } from "@/lib/inquiries";

const TOKEN_KEY = "takoshin:admin";

function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function dateJa(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function api<T>(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      "x-admin-token": token,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as T,
  };
}

interface SurveyInfo {
  nickname: string;
  status: string;
  targetCount: number;
  remaining: number;
}

export function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [list, setList] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<
    Record<string, SurveyInfo | "missing">
  >({});

  const load = useCallback(async (t: string) => {
    const r = await api<{ inquiries?: Inquiry[] }>(t, "/inquiries");
    if (r.status === 200) {
      setList(r.data.inquiries ?? []);
      setError(null);
      try {
        window.sessionStorage.setItem(TOKEN_KEY, t);
      } catch {
        // 覚えられなくても使える
      }
      setToken(t);
    } else {
      setToken(null);
      setList(null);
      setError(
        r.status === 429
          ? "まちがいが多すぎます。1 時間ほど待ってください"
          : "合言葉がちがいます",
      );
    }
  }, []);

  useEffect(() => {
    const t = readToken();
    // 通信のあとで状態を変える
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) void load(t);
  }, [load]);

  if (!token || !list) {
    return (
      <main className="page stack">
        <Header />
        <h1 style={{ marginTop: 8 }}>運営者のページ</h1>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (input) void load(input);
          }}
        >
          <label className="label" htmlFor="token" style={{ marginBottom: 0 }}>
            合言葉
          </label>
          <input
            id="token"
            className="input"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="current-password"
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn">
            入る
          </button>
        </form>
      </main>
    );
  }

  const open = list.filter((i) => !i.handled).length;
  return (
    <main className="page stack">
      <Header
        right={
          <button
            type="button"
            className="btn ghost small"
            style={{ width: "auto" }}
            onClick={() => {
              try {
                window.sessionStorage.removeItem(TOKEN_KEY);
              } catch {
                // 何もしない
              }
              setToken(null);
              setList(null);
              setInput("");
            }}
          >
            出る
          </button>
        }
      />
      <h1 style={{ marginTop: 8 }}>問い合わせ</h1>
      <p className="muted small">
        未対応 {open} 件 ／ 全 {list.length} 件（受け付けてから 180
        日で自動的に消えます）
      </p>
      <button
        type="button"
        className="btn secondary"
        onClick={() => void load(token)}
      >
        読み直す
      </button>
      {list.length === 0 && (
        <p className="muted center">まだ問い合わせはありません。</p>
      )}
      {list.map((q) => {
        const info = q.surveyId ? surveys[q.surveyId] : undefined;
        return (
          <article
            key={q.id}
            className="card stack"
            style={q.handled ? { opacity: 0.6 } : undefined}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <b>
                {INQUIRY_KINDS.find((k) => k.id === q.kind)?.label ?? q.kind}
              </b>
              <span className="muted small">
                {dateJa(q.createdAt)}
                {q.handled ? "・対応済み" : ""}
              </span>
            </div>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {q.body}
            </p>
            {q.replyTo && (
              <p className="small" style={{ overflowWrap: "anywhere" }}>
                連絡先：{q.replyTo}
              </p>
            )}
            {q.surveyRef && (
              <div className="notice stack">
                <p className="small" style={{ overflowWrap: "anywhere" }}>
                  対象の診断：{q.surveyRef}
                </p>
                {q.surveyId ? (
                  info === undefined ? (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={async () => {
                        const r = await api<SurveyInfo>(
                          token,
                          `/surveys/${q.surveyId}`,
                        );
                        setSurveys((s) => ({
                          ...s,
                          [q.surveyId!]: r.status === 200 ? r.data : "missing",
                        }));
                      }}
                    >
                      診断を確かめる
                    </button>
                  ) : info === "missing" ? (
                    <p className="small">この診断はもうありません。</p>
                  ) : (
                    <>
                      <p className="small">
                        呼び名「{info.nickname}」・状態 {info.status}・
                        {info.targetCount} 人中あと {info.remaining} 人
                      </p>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `「${info.nickname}」の診断を消します。元に戻せません。よろしいですか？`,
                            )
                          )
                            return;
                          const r = await api(token, `/surveys/${q.surveyId}`, {
                            method: "DELETE",
                          });
                          setSurveys((s) => ({
                            ...s,
                            [q.surveyId!]: "missing",
                          }));
                          if (r.status !== 200)
                            window.alert(
                              "消せませんでした（もう消えている可能性があります）",
                            );
                        }}
                      >
                        この診断を消す
                      </button>
                    </>
                  )
                ) : (
                  <p className="small">
                    招待リンクの形ではないので、診断を特定できません。
                  </p>
                )}
              </div>
            )}
            <div className="btn-row">
              <button
                type="button"
                className="btn secondary"
                onClick={async () => {
                  await api(token, `/inquiries/${q.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ handled: !q.handled }),
                  });
                  await load(token);
                }}
              >
                {q.handled ? "未対応に戻す" : "対応済みにする"}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "この問い合わせを消します。よろしいですか？",
                    )
                  )
                    return;
                  await api(token, `/inquiries/${q.id}`, { method: "DELETE" });
                  await load(token);
                }}
              >
                消す
              </button>
            </div>
          </article>
        );
      })}
    </main>
  );
}
