"use client";
// この端末で作った診断の一覧（仕様書 §4.2・§8.3）。
// それぞれの今の状態（結果が出た・あと何人）も出して、戻ってくる理由にする
import { useEffect, useMemo, useState } from "react";
import {
  SAVED_KEY,
  hostApi,
  useStoredRaw,
  type SavedSurvey,
} from "@/lib/client";

interface Progress {
  status: "open" | "completed" | "expired";
  targetCount: number;
  responseCount: number;
}

// 状態の札。取れなかったとき（通信の失敗など）は何も出さない
function statusLabel(p: Progress | "gone" | undefined): {
  text: string;
  done: boolean;
} | null {
  if (p === undefined) return null;
  if (p === "gone") return { text: "見つかりません", done: false };
  if (p.status === "completed") return { text: "結果が出ました", done: true };
  if (p.status === "expired") return { text: "期限切れ", done: false };
  return { text: `あと ${p.targetCount - p.responseCount} 人`, done: false };
}

export function MySurveys() {
  const raw = useStoredRaw(SAVED_KEY);
  const list = useMemo<SavedSurvey[]>(() => {
    try {
      const v: unknown = raw ? JSON.parse(raw) : [];
      // 壊れた値が入っていても、トップが壊れないように
      return Array.isArray(v)
        ? (v as SavedSurvey[]).filter((s) => s && typeof s.hostKey === "string")
        : [];
    } catch {
      return [];
    }
  }, [raw]);
  const [progress, setProgress] = useState<Record<string, Progress | "gone">>(
    {},
  );

  // 状態だけを返す軽い API を、4 件ずつ順に呼ぶ（最大 100 件を一度に呼ぶと、サーバーに負担がかかるため）
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (let i = 0; i < list.length && alive; i += 4) {
        await Promise.all(
          list.slice(i, i + 4).map((s) =>
            hostApi<Progress>("/summary", s.hostKey)
              .then(({ ok, status, data }) => {
                if (!alive) return;
                if (ok) setProgress((p) => ({ ...p, [s.hostKey]: data }));
                else if (status === 404)
                  setProgress((p) => ({ ...p, [s.hostKey]: "gone" }));
              })
              .catch(() => {}),
          ),
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [list]);

  if (list.length === 0) return null;
  return (
    <section className="card stack" aria-label="つくった診断">
      <h2 style={{ fontSize: 17 }}>つくった診断</h2>
      <ul className="list-plain">
        {list.map((s) => {
          const label = statusLabel(progress[s.hostKey]);
          return (
            <li key={s.hostKey} className="stack" style={{ gap: 4 }}>
              <a
                href={`/h#${s.hostKey}`}
                className="btn secondary"
                style={{ justifyContent: "space-between" }}
              >
                <span>{s.nickname} の診断</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {label && (
                    <span className={`status-chip${label.done ? " done" : ""}`}>
                      {label.text}
                    </span>
                  )}
                  <span aria-hidden="true">→</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
