"use client";
// グループ診断のページ（仕様書 §4.16）。
// - まだ参加していない人：呼び名を入れて参加する
// - 集まっているあいだ：メンバーの呼び名と、グループのリンクを送るボタン。作った人は 4 人以上で締め切って始められる
// - 始めたあと：ほかのメンバーに「答える」（ふつうの回答の画面へ）。自分の診断は、あと何人かだけ
// だれがだれに答えたかは、サーバーから受け取らない。「答えた」の印は、この端末で答えたものだけ

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Shell";
import { LineShare } from "@/components/LineShare";
import { Octopus } from "@/components/Octopus";
import {
  GROUP_ANSWERED_KEY,
  copyText,
  saveGroup,
  saveSurvey,
  savedGroups,
  useClientValue,
  useDialogFocus,
  useOrigin,
  useShareOrigin,
  useStoredRaw,
  withFrom,
} from "@/lib/client";
import { charLength, NICKNAME_MAX } from "@/lib/text";
import { captureOrigin, currentOrigin, isTester } from "@/lib/track";
import { ANSWER_TIME_LABEL } from "@/data/questions";
import type { GroupView } from "@/lib/groups";

const START_MIN = 4;
const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

type Load =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "network" }
  | { kind: "ready"; view: GroupView };

const JOIN_ERRORS: Record<string, string> = {
  empty: "呼び名を入れてください",
  too_long: `呼び名は ${NICKNAME_MAX} 文字までです`,
  ng_word: "その呼び名は使えません。別の呼び名にしてください",
  duplicate_name:
    "同じ呼び名の人が、もうグループにいます。別の呼び名にしてください",
  closed: "ちょうど締め切られました。このグループには、もう参加できません",
  expired: "このグループは期限が切れました",
  rate_limited:
    "短い時間にたくさん参加が送られています。しばらくしてから試してください",
};

// グループのリンクを送る文。何をするか・かかる時間・登録なし・匿名を入れる。実装より強い言い方はしない
export function groupInviteMessage(url: string, size: number): string {
  const time = ANSWER_TIME_LABEL.replace(/\s/g, "");
  const body = `みんなでおたがいのことを答えて、「周りから見た自分」を知ろう！ 登録なし・1人につき${time}。1人ずつの答えは本人にも表示されません。${size}人そろったら始まるので、ここから参加してね。`;
  return url ? `${body}\n${url}` : body;
}

// この端末に覚えているグループの鍵。# の後ろに鍵があれば（自分用のリンク）、そちらを使う
function storedKeys(groupId: string): string {
  const hash = window.location.hash.replace(/^#/, "");
  const saved = savedGroups().find((g) => g.groupId === groupId);
  const hostKey = KEY_RE.test(hash) ? hash : (saved?.hostKey ?? "");
  // 作った人の鍵は、同じ管理用の鍵のときだけ使う
  const adminKey =
    saved && saved.hostKey === hostKey ? (saved.adminKey ?? "") : "";
  return `${hostKey}|${adminKey}`;
}

export function GroupPage({ groupId }: { groupId: string }) {
  const keys = useClientValue(() => storedKeys(groupId), null);
  const [joined, setJoined] = useState<string | null>(null);
  const [storedHost, storedAdmin] = (keys ?? "|").split("|");
  const hostKey = joined ?? (storedHost || null);
  const adminKey = joined ? null : storedAdmin || null;
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const fetchView = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        cache: "no-store",
        headers: {
          ...(hostKey ? { "x-host-key": hostKey } : {}),
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
      });
      if (res.status === 404) return setLoad({ kind: "not_found" });
      if (!res.ok)
        return setLoad((s) => (s.kind === "ready" ? s : { kind: "network" }));
      const view = (await res.json()) as GroupView;
      setLoad({ kind: "ready", view });
      if (view.member && hostKey && view.mine) {
        saveGroup({
          groupId,
          hostKey,
          ...(view.admin && adminKey ? { adminKey } : {}),
          nickname: view.mine.nickname,
          createdAt: new Date().toISOString(),
        });
        // 始まったら、自分の診断を「つくった診断」にも入れる（トップから結果を見に来られるように）
        if (view.mine.surveyId)
          saveSurvey({
            hostKey,
            surveyId: view.mine.surveyId,
            nickname: view.mine.nickname,
            createdAt: new Date().toISOString(),
          });
      }
    } catch {
      setLoad((s) => (s.kind === "ready" ? s : { kind: "network" }));
    }
  }, [groupId, hostKey, adminKey]);

  // 開いたとき（鍵を読み終えたあと）と、10 秒ごと（画面が見えているときだけ）に読み直す
  useEffect(() => {
    if (keys === null) return;
    // fetchView は通信のあとで状態を変える（同期的には変えない）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchView();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => void fetchView(), 10_000);
    };
    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchView();
        start();
      } else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [keys, fetchView]);

  if (load.kind === "loading") {
    return (
      <main className="page center" aria-busy="true">
        <p className="muted" style={{ marginTop: "40dvh" }}>
          読み込み中…
        </p>
      </main>
    );
  }
  if (load.kind !== "ready") {
    return (
      <main className="page stack center" style={{ paddingTop: 64 }}>
        <Octopus code="ISFP" size={120} />
        <h1>
          {load.kind === "not_found"
            ? "このグループは見つかりませんでした"
            : "うまく読み込めませんでした"}
        </h1>
        <p>
          {load.kind === "not_found"
            ? "リンクがまちがっているか、もう削除されています。"
            : "通信の状態を確かめて、もう一度開いてください。"}
        </p>
        {load.kind === "network" ? (
          <button
            type="button"
            className="btn"
            onClick={() => window.location.reload()}
          >
            もう一度読み込む
          </button>
        ) : (
          <Link href="/g/new" className="btn">
            グループをつくる
          </Link>
        )}
      </main>
    );
  }

  const { view } = load;
  if (!view.member)
    return (
      <JoinView
        groupId={groupId}
        view={view}
        onJoined={(key) => setJoined(key)}
      />
    );
  if (view.status === "started" && hostKey)
    return <StartedView groupId={groupId} view={view} hostKey={hostKey} />;
  if (view.status === "expired")
    return (
      <main className="page stack center" style={{ paddingTop: 64 }}>
        <Octopus code="ISFP" size={120} />
        <h1>このグループは期限が切れました</h1>
        <p>人数がそろわないまま、受付の期限を過ぎました。</p>
        <Link href="/g/new" className="btn">
          新しいグループをつくる
        </Link>
      </main>
    );
  return (
    <JoiningView
      groupId={groupId}
      view={view}
      hostKey={hostKey!}
      adminKey={view.admin ? adminKey : null}
      reload={fetchView}
    />
  );
}

// まだ参加していない人の画面
function JoinView({
  groupId,
  view,
  onJoined,
}: {
  groupId: string;
  view: GroupView;
  onJoined: (hostKey: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = nickname.trim();
  const len = charLength(trimmed);
  const valid = len > 0 && len <= NICKNAME_MAX;

  useEffect(() => {
    captureOrigin();
  }, []);

  if (view.status !== "joining") {
    return (
      <main className="page stack center" style={{ paddingTop: 64 }}>
        <Octopus code="ISFP" size={120} />
        <h1>
          {view.status === "started"
            ? "このグループはもう始まっています"
            : "このグループは期限が切れました"}
        </h1>
        <p>
          {view.status === "started"
            ? "あとから参加することはできません。"
            : "人数がそろわないまま、受付の期限を過ぎました。"}
        </p>
        <Link href="/new" className="btn">
          自分の診断をつくる
        </Link>
      </main>
    );
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: trimmed,
          ...currentOrigin(),
          test: isTester(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        hostKey?: string;
      };
      if (data.status === "ok" && data.hostKey) {
        saveGroup({
          groupId,
          hostKey: data.hostKey,
          nickname: trimmed,
          createdAt: new Date().toISOString(),
        });
        onJoined(data.hostKey);
        return;
      }
      setError(
        JOIN_ERRORS[data.status ?? ""] ??
          "うまく参加できませんでした。もう一度試してください",
      );
    } catch {
      setError(
        "通信できませんでした。電波のよいところでもう一度試してください",
      );
    }
    setBusy(false);
  }

  return (
    <main className="page stack">
      <Header />
      <Octopus code="ENFP" size={120} />
      <h1 className="center">
        <span style={{ color: "var(--brand)" }}>{view.creator}</span>{" "}
        のグループ診断
      </h1>
      <p>
        メンバーみんなで、おたがいのことを答えあいます。{view.size}{" "}
        人そろうと始まり、それぞれに「周りから見たあなた」が届きます。
      </p>
      <p className="big-count center" aria-live="polite">
        {view.joined} / {view.size} 人 参加
      </p>
      <ul className="muted small">
        <li>
          始まったら、ほかのメンバー 1 人ずつについて答えます（1 人につき
          {ANSWER_TIME_LABEL}）
        </li>
        <li>
          1
          人ずつの答えは本人にも表示されず、みんなの答えをまとめた結果だけが届きます
        </li>
        <li>自分の結果は、自分だけが見られます</li>
      </ul>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) void join();
        }}
      >
        <div className="card">
          <label className="label" htmlFor="nickname">
            あなたの呼び名
          </label>
          <input
            id="nickname"
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="グループのみんなが分かる名前"
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby="nickname-note"
          />
          <p
            id="nickname-note"
            className="muted small"
            style={{ marginTop: 8 }}
          >
            質問は「{trimmed || "あなた"}は、…」のように出ます。{len}/
            {NICKNAME_MAX} 文字
          </p>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="bottom-bar stack with-note">
          <p className="muted small center">
            参加すると、<a href="/terms">利用規約</a>と
            <a href="/privacy">プライバシーポリシー</a>
            に同意したことになります。
          </p>
          <button type="submit" className="btn" disabled={!valid || busy}>
            {busy ? "参加しています…" : "参加する"}
          </button>
        </div>
      </form>
    </main>
  );
}

// 集まっているあいだ（メンバー）
function JoiningView({
  groupId,
  view,
  hostKey,
  adminKey,
  reload,
}: {
  groupId: string;
  view: GroupView;
  hostKey: string;
  adminKey: string | null;
  reload: () => Promise<void>;
}) {
  const origin = useShareOrigin();
  const url = origin ? `${origin}/g/${groupId}` : "";
  const text = groupInviteMessage("", view.size);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setConfirm(false), []);
  const dialogRef = useDialogFocus<HTMLDivElement>(confirm, close);
  const left = view.size - view.joined;

  async function start() {
    if (!adminKey) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/start`, {
        method: "POST",
        headers: { "x-admin-key": adminKey, "x-host-key": hostKey },
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string };
      if (data.status !== "ok" && data.status !== "closed")
        setError(
          data.status === "not_enough"
            ? `始めるには ${START_MIN} 人以上が必要です`
            : "うまく始められませんでした。もう一度試してください",
        );
    } catch {
      setError("通信できませんでした。もう一度試してください");
    }
    setConfirm(false);
    setBusy(false);
    await reload();
  }

  return (
    <main className="page stack">
      <Header />
      <h1>
        あと {left} 人で
        <br />
        スタート！
      </h1>
      <p className="big-count" aria-live="polite">
        {view.joined} / {view.size} 人 参加
      </p>
      <section className="card stack" aria-label="メンバー">
        <b>メンバー</b>
        <ul className="list-plain">
          {view.members?.map((m) => (
            <li key={m.nickname}>
              {m.nickname}
              {m.me && <span className="muted small">（あなた）</span>}
            </li>
          ))}
        </ul>
        <p className="muted small">
          {view.size}{" "}
          人そろうと、自動で始まります。始まるまでは、だれも答えられません。
        </p>
      </section>

      <section className="card stack">
        <b>グループのリンクを送る</b>
        <p className="invite-preview">
          {text}
          <br />
          <span className="invite-preview-url">{url}</span>
        </p>
        <LineShare
          text={text}
          url={withFrom(url, "line")}
          className="btn line"
        />
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            if (
              await copyText(
                groupInviteMessage(withFrom(url, "copy"), view.size),
              )
            ) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? "コピーした！" : "文章＋リンクをコピー"}
        </button>
      </section>

      {adminKey && (
        <section className="card stack">
          <b>人数を待たずに始める</b>
          {view.joined >= START_MIN ? (
            <>
              <p className="small">
                いまの {view.joined}{" "}
                人で締め切って始められます。始めたあとは、だれも参加できません。
              </p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setConfirm(true)}
              >
                ここで締め切って始める
              </button>
            </>
          ) : (
            <p className="muted small">
              {START_MIN} 人以上集まると、ここで締め切って始められます。
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      <KeepGroupLink groupId={groupId} hostKey={hostKey} />

      {confirm && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-title"
          ref={dialogRef}
        >
          <div className="dialog stack">
            <h2 id="start-title">{view.joined} 人で始める？</h2>
            <p>
              1 人につき、ほかの {view.joined - 1}{" "}
              人が答えます。始めたあとは、だれも参加できません。
            </p>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void start()}
            >
              {busy ? "始めています…" : "始める"}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={close}
            >
              もどる
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// 始めたあと（メンバー）
function StartedView({
  groupId,
  view,
  hostKey,
}: {
  groupId: string;
  view: GroupView;
  hostKey: string;
}) {
  const raw = useStoredRaw(GROUP_ANSWERED_KEY);
  const answered = useMemo(() => {
    try {
      const v: unknown = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(v) ? (v as string[]) : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const others = (view.members ?? []).filter((m) => !m.me);
  const mine = view.mine!;

  return (
    <main className="page stack">
      <Header />
      <h1>みんなについて答えよう</h1>
      <p className="muted small">
        1 人につき{ANSWER_TIME_LABEL}。1
        人ずつの答えは本人にも表示されず、みんなの答えをまとめた結果だけが届きます。
      </p>
      <ul className="list-plain stack" aria-label="答える相手">
        {others.map((m) => {
          const done = m.surveyId ? answered.has(m.surveyId) : false;
          return (
            <li key={m.nickname}>
              {m.surveyId === null ? (
                <span className="btn secondary" aria-disabled="true">
                  <span>{m.nickname}</span>
                  <span className="muted small">答えられません</span>
                </span>
              ) : (
                <a
                  href={`/a/${m.surveyId}?g=${groupId}`}
                  className={done ? "btn secondary" : "btn"}
                  style={{ justifyContent: "space-between" }}
                >
                  <span>{m.nickname}</span>
                  {done ? (
                    <span className="status-chip done">答えた</span>
                  ) : (
                    <span>
                      答える <span aria-hidden="true">→</span>
                    </span>
                  )}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        「答えた」は、この端末で答えた印です（だれが答えたかは、どこにも表示されません）。
      </p>

      <section className="card stack" aria-label="あなたの診断">
        <b>{mine.nickname}（あなた）の診断</b>
        {mine.status === "open" && (
          <>
            <p className="big-count" aria-live="polite">
              あと {mine.remaining} 人で結果発表！
            </p>
            <p className="muted small">
              結果は、ほかのメンバーみんなが答えたら、あなただけが見られます。
            </p>
            <a href={`/h#${hostKey}`} className="btn secondary">
              回答状況を見る
            </a>
          </>
        )}
        {mine.status === "completed" && (
          <>
            <p className="big-count">結果が出ました！</p>
            <a href={`/h/result#${hostKey}`} className="btn">
              結果を見る
            </a>
          </>
        )}
        {mine.status === "expired" && (
          <p>期限が切れたため、結果は出ませんでした。</p>
        )}
        {mine.status === "deleted" && <p>あなたの診断は消されました。</p>}
      </section>

      <KeepGroupLink groupId={groupId} hostKey={hostKey} />
    </main>
  );
}

// 別の端末で開くための、自分用のリンク（/g/<ID>#<管理用の鍵>）。人に送らない
function KeepGroupLink({
  groupId,
  hostKey,
}: {
  groupId: string;
  hostKey: string;
}) {
  const origin = useOrigin();
  const url = origin ? `${origin}/g/${groupId}#${hostKey}` : "";
  const [copied, setCopied] = useState(false);
  return (
    <div className="notice stack">
      <p>
        <b>自分用のリンク</b>
        は、別の端末でこのページを開くときに使います（結果も見られるので、人に送らない）。
      </p>
      <LineShare
        text="たこ診のグループ（自分だけ用・人に送らない）→"
        url={url}
        className="btn secondary"
      >
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
        {copied ? "コピーした！" : "自分用のリンクをコピー"}
      </button>
    </div>
  );
}
