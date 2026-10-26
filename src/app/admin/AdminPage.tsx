"use client";
// 運営者のページ。問い合わせを読み、報告された診断を消せる。
// 招待リンク・公開リンクがどの送り方で開かれたかの件数と、応援のお願いの集計も見られる。
// 入り方は 2 つ：パスキー（指紋・顔認証）か、合言葉（ADMIN_TOKEN）。
// パスキーで入ると、サーバーが 12 時間使える鍵を cookie で渡す。
// 合言葉で入ったときは、合言葉をこのタブの中だけに覚える（タブを閉じると忘れる）

import { useCallback, useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { Header } from "@/components/Shell";
import { useClientValue } from "@/lib/client";
import { INQUIRY_KINDS } from "@/data/inquiry";
import { VISIT_PAGES, VISIT_SOURCES } from "@/data/sources";
import type { Inquiry } from "@/lib/inquiries";
import type { Passkey } from "@/lib/passkeys";
import type { VisitSummary } from "@/lib/visits";
import type { SupportSummary } from "@/lib/supportStats";

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

// token が null のときは、パスキーで入ったときの cookie で入る
async function api<T>(
  token: string | null,
  path: string,
  init: RequestInit = {},
) {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      ...(token ? { "x-admin-token": token } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as T,
  };
}

// パスキーの名前（どの端末で登録したか分かるように）
function deviceName(): string {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "この端末";
  return kind;
}

function passkeyError(e: unknown, login = false): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError")
    return login
      ? "入れませんでした。取りやめたか、この端末に使えるパスキーがありません。はじめての端末は、合言葉で入ってから登録してください"
      : "取りやめました（または時間切れです）。もう一度試してください";
  if (name === "InvalidStateError")
    return "この端末のパスキーは、もう登録してあります";
  return "うまくいきませんでした。もう一度試してください";
}

function PasskeysCard({ token }: { token: string | null }) {
  const [list, setList] = useState<Passkey[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = useClientValue(browserSupportsWebAuthn, false);

  const reload = useCallback(async () => {
    const r = await api<{ passkeys?: Passkey[] }>(token, "/passkeys");
    if (r.status === 200) setList(r.data.passkeys ?? []);
  }, [token]);

  useEffect(() => {
    // 通信のあとで状態を変える
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function register() {
    setBusy(true);
    setMsg(null);
    try {
      const o = await api<
        Parameters<typeof startRegistration>[0]["optionsJSON"]
      >(token, "/passkeys/register/options", { method: "POST" });
      if (o.status !== 200) throw new Error("options");
      const response = await startRegistration({ optionsJSON: o.data });
      const r = await api(token, "/passkeys/register", {
        method: "POST",
        body: JSON.stringify({ response, name: deviceName() }),
      });
      if (r.status !== 201) throw new Error("verify");
      setMsg("登録しました。次からは指紋・顔認証で入れます");
      await reload();
    } catch (e) {
      setMsg(passkeyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <b>指紋・顔認証（パスキー）</b>
      <p className="muted small">
        この端末を登録すると、次からは合言葉なしで、指紋や顔認証で入れます。指紋や顔のデータは端末の外に出ません。合言葉は、端末をなくしたときの予備として残ります。
      </p>
      {list && list.length > 0 && (
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {list.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span className="small">
                <b>{p.name}</b>
                <br />
                <span className="muted">
                  登録 {dateJa(p.createdAt)}
                  {p.lastUsedAt
                    ? `・最後に使った日 ${dateJa(p.lastUsedAt)}`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                className="btn danger small"
                style={{ width: "auto" }}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `「${p.name}」のパスキーを外します。この端末では指紋・顔認証で入れなくなります。よろしいですか？`,
                    )
                  )
                    return;
                  await api(token, `/passkeys/${encodeURIComponent(p.id)}`, {
                    method: "DELETE",
                  });
                  await reload();
                }}
              >
                外す
              </button>
            </li>
          ))}
        </ul>
      )}
      {supported ? (
        <button
          type="button"
          className="btn secondary"
          onClick={() => void register()}
          disabled={busy}
        >
          {busy ? "登録中…" : "この端末を登録する"}
        </button>
      ) : (
        <p className="small">このブラウザはパスキーに対応していません。</p>
      )}
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

interface SurveyInfo {
  nickname: string;
  status: string;
  targetCount: number;
  remaining: number;
}

// どの送り方で開かれたかの表（行：送り方、列：ページ）
function VisitTable({ summary }: { summary: VisitSummary }) {
  const total = (page: (typeof VISIT_PAGES)[number]["id"]) =>
    VISIT_SOURCES.reduce((n, s) => n + summary.counts[page][s.id], 0);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="visit-table">
        <thead>
          <tr>
            <th>送り方</th>
            {VISIT_PAGES.map((p) => (
              <th key={p.id}>{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {VISIT_SOURCES.map((s) => (
            <tr key={s.id}>
              <th>{s.label}</th>
              {VISIT_PAGES.map((p) => (
                <td key={p.id}>
                  {p.id === "top" && s.id === "none"
                    ? "—"
                    : summary.counts[p.id][s.id]}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th>合計</th>
            {VISIT_PAGES.map((p) => (
              <td key={p.id}>
                <b>{total(p.id)}</b>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function VisitsCard({
  visits,
}: {
  visits: { week: VisitSummary; month: VisitSummary } | null;
}) {
  const [range, setRange] = useState<"week" | "month">("week");
  if (!visits) return null;
  return (
    <section className="card stack">
      <b>どこから開かれたか</b>
      <div className="btn-row">
        {(["week", "month"] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={`btn ${range === r ? "" : "secondary"} small`}
            onClick={() => setRange(r)}
            aria-pressed={range === r}
          >
            最近 {visits[r].days} 日
          </button>
        ))}
      </div>
      <VisitTable summary={visits[range]} />
      <p className="muted small">
        {VISIT_PAGES.map((p) => `${p.label}＝${p.note}`).join("、")}。
        リンクが開かれた回数（日本時間で今日まで）で、同じ人が開き直した分も入ります。だれが開いたか・どの診断かは記録していません。
      </p>
    </section>
  );
}

type SupportRange = "week" | "month" | "all";
const SUPPORT_RANGES: { id: SupportRange; label: string }[] = [
  { id: "week", label: "最近 7 日" },
  { id: "month", label: "最近 30 日" },
  { id: "all", label: "すべて" },
];

// 割合（見た診断のうち）。0 件のときは —
function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "—";
}

function SupportCard({
  support,
}: {
  support: Record<SupportRange, SupportSummary> | null;
}) {
  const [range, setRange] = useState<SupportRange>("week");
  if (!support) return null;
  const s = support[range];
  const cell = (n: number) => (
    <td>
      {n}
      <span className="muted small">（{pct(n, s.seen)}）</span>
    </td>
  );
  return (
    <section className="card stack">
      <b>応援のお願い</b>
      <div className="btn-row">
        {SUPPORT_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`btn ${range === r.id ? "" : "secondary"} small`}
            onClick={() => setRange(r.id)}
            aria-pressed={range === r.id}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="small">応援のお願いを見た診断：{s.seen} 件</p>
      <div style={{ overflowX: "auto" }}>
        <table className="visit-table">
          <thead>
            <tr>
              <th></th>
              <th>支払った</th>
              <th>支払っていない</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>応援するを押した</th>
              {cell(s.giftPaid)}
              {cell(s.giftUnpaid)}
            </tr>
            <tr>
              <th>押していない</th>
              {cell(s.noGiftPaid)}
              {cell(s.noGiftUnpaid)}
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="muted small" style={{ margin: 0, paddingLeft: 20 }}>
        <li>
          押していない・支払っていないのうち「今回は閉じる」を押した：{s.closed}{" "}
          件（残りは何もしなかった）
        </li>
        <li>支払いのページを開いたが、支払っていない：{s.checkoutUnpaid} 件</li>
      </ul>
      <p className="muted small">
        1 行が 1
        つの診断です。期間は、その診断が最初に応援のお願いを見た日（日本時間）で分けます。
        支払いのボタンは「応援する」を押したあとにだけ出るので、「押していない・支払った」はふつう
        0 件です。割合は、見た診断に対するものです。記録は 400 日で消えます。
      </p>
    </section>
  );
}

export function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const passkeySupported = useClientValue(browserSupportsWebAuthn, false);
  const [input, setInput] = useState("");
  const [list, setList] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<{
    week: VisitSummary;
    month: VisitSummary;
  } | null>(null);
  const [support, setSupport] = useState<Record<
    SupportRange,
    SupportSummary
  > | null>(null);
  const [surveys, setSurveys] = useState<
    Record<string, SurveyInfo | "missing">
  >({});

  // t が null のときは、パスキーで入ったときの cookie で入る。quiet なら、入れなくても何も言わない
  const load = useCallback(async (t: string | null, quiet = false) => {
    const r = await api<{ inquiries?: Inquiry[] }>(t, "/inquiries");
    if (r.status === 200) {
      setList(r.data.inquiries ?? []);
      setError(null);
      if (t) {
        try {
          window.sessionStorage.setItem(TOKEN_KEY, t);
        } catch {
          // 覚えられなくても使える
        }
      }
      setToken(t);
      setSignedIn(true);
      const v = await api<{ week?: VisitSummary; month?: VisitSummary }>(
        t,
        "/visits",
      );
      if (v.status === 200 && v.data.week && v.data.month)
        setVisits({ week: v.data.week, month: v.data.month });
      const sp = await api<Partial<Record<SupportRange, SupportSummary>>>(
        t,
        "/support",
      );
      if (sp.status === 200 && sp.data.week && sp.data.month && sp.data.all)
        setSupport({
          week: sp.data.week,
          month: sp.data.month,
          all: sp.data.all,
        });
    } else {
      setToken(null);
      setList(null);
      setSignedIn(false);
      if (!quiet)
        setError(
          r.status === 429
            ? "まちがいが多すぎます。1 時間ほど待ってください"
            : t
              ? "合言葉がちがいます"
              : "入れませんでした。もう一度試してください",
        );
    }
  }, []);

  async function passkeyLogin() {
    setError(null);
    try {
      const o = await fetch("/api/admin/login/options", { method: "POST" });
      if (o.status === 429)
        return setError("まちがいが多すぎます。1 時間ほど待ってください");
      const response = await startAuthentication({
        optionsJSON: await o.json(),
      });
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (r.status !== 200)
        return setError(
          r.status === 429
            ? "まちがいが多すぎます。1 時間ほど待ってください"
            : "このパスキーは登録されていません。合言葉で入ってから登録してください",
        );
      await load(null);
    } catch (e) {
      setError(passkeyError(e, true));
    }
  }

  useEffect(() => {
    // 合言葉を覚えていればそれで、なければパスキーで入ったときの cookie で入ってみる
    // 通信のあとで状態を変える
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(readToken(), true);
  }, [load]);

  if (!signedIn || !list) {
    return (
      <main className="page stack">
        <Header />
        <h1 style={{ marginTop: 8 }}>運営者のページ</h1>
        {passkeySupported && (
          <button
            type="button"
            className="btn"
            onClick={() => void passkeyLogin()}
          >
            指紋・顔認証で入る
          </button>
        )}
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
          <button type="submit" className="btn secondary">
            合言葉で入る
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
              void fetch("/api/admin/logout", { method: "POST" });
              setToken(null);
              setSignedIn(false);
              setList(null);
              setInput("");
            }}
          >
            出る
          </button>
        }
      />
      <VisitsCard visits={visits} />
      <SupportCard support={support} />
      <PasskeysCard token={token} />
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
