"use client";
// この端末で作った診断の一覧（仕様書 §4.2・§8.3）
import { useMemo } from "react";
import { SAVED_KEY, useStoredRaw, type SavedSurvey } from "@/lib/client";

export function MySurveys() {
  const raw = useStoredRaw(SAVED_KEY);
  const list = useMemo<SavedSurvey[]>(() => {
    try {
      return raw ? (JSON.parse(raw) as SavedSurvey[]) : [];
    } catch {
      return [];
    }
  }, [raw]);
  if (list.length === 0) return null;
  return (
    <section className="card stack" aria-label="つくった診断">
      <h2 style={{ fontSize: 17 }}>つくった診断</h2>
      <ul className="list-plain">
        {list.map((s) => (
          <li key={s.hostKey} className="stack" style={{ gap: 4 }}>
            <a
              href={`/h#${s.hostKey}`}
              className="btn secondary"
              style={{ justifyContent: "space-between" }}
            >
              <span>{s.nickname} の診断</span>
              <span aria-hidden="true">→</span>
            </a>
            <a href={`/h/more#${s.hostKey}`} className="btn ghost small">
              人数をふやして、もっと聞く
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
