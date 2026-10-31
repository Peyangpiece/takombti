"use client";
// もう一度、友達に聞く（仕様書 §4.11）。同じ呼び名・同じ人数で新しい診断を作り、
// 新しい診断と、今の結果のまとめ（4 文字・4 軸の極と割合・結果が出た日）を、この端末にだけ覚える
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AXES, getType, type TypeCode } from "@/data/framework";
import {
  AGAIN_KEY,
  againRecords,
  saveAgain,
  saveSurvey,
  savedSurveys,
  useStoredRaw,
  type AgainRecord,
} from "@/lib/client";
import { axisChange, monthDay, type AxisPoint } from "@/lib/compare";
import type { AxisResult } from "@/lib/scoring";
import { currentOrigin, isTester } from "@/lib/track";

const ERRORS: Record<string, string> = {
  rate_limited:
    "短い時間にたくさん作られています。しばらくしてから試してください",
};

// 覚えてある記録を読む（保存領域の値が変わったら読み直す）
function useAgainRecords(): AgainRecord[] {
  const raw = useStoredRaw(AGAIN_KEY);
  // raw は読み直しの合図にだけ使う
  return useMemo(() => (raw === null ? [] : againRecords()), [raw]);
}

export function AskAgain({
  surveyId,
  nickname,
  targetCount,
  type,
  axes,
  completedAt,
}: {
  surveyId: string;
  nickname: string;
  targetCount: number;
  type: TypeCode;
  axes: AxisResult[];
  completedAt: string | null;
}) {
  const router = useRouter();
  const records = useAgainRecords();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // この結果から、もう作ってある新しい診断（この端末で作り、まだ一覧にあるもの）
  const made = records.find((r) => r.prevSurveyId === surveyId);
  const madeHost = made
    ? savedSurveys().find((s) => s.surveyId === made.newSurveyId)?.hostKey
    : undefined;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          targetCount,
          ...currentOrigin(),
          // 計測の入口（§11.11）
          entry: "again",
          test: isTester(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        surveyId?: string;
        hostKey?: string;
        error?: string;
      };
      if (!res.ok || !data.surveyId || !data.hostKey) {
        setError(
          ERRORS[data.error ?? ""] ??
            "うまく作れませんでした。もう一度試してください",
        );
        setBusy(false);
        return;
      }
      saveSurvey({
        hostKey: data.hostKey,
        surveyId: data.surveyId,
        nickname,
        createdAt: new Date().toISOString(),
      });
      saveAgain({
        prevSurveyId: surveyId,
        newSurveyId: data.surveyId,
        type,
        axes: axes.map(({ axis, pole, percent, tie }) => ({
          axis,
          pole,
          percent,
          tie,
        })),
        date: completedAt,
      });
      // 作った直後は、招待リンクの共有へ（§4.3 と同じ）。移るまで押せないまま
      router.push(`/h/share#${data.hostKey}`);
    } catch {
      setError(
        "通信できませんでした。電波のよいところでもう一度試してください",
      );
      setBusy(false);
    }
  }

  if (made && madeHost)
    return (
      <div className="card stack">
        <p>この結果のあとに、もう一度聞く診断をつくっています。</p>
        <a href={`/h#${madeHost}`} className="btn secondary">
          もう一度聞いた診断を見る
        </a>
      </div>
    );

  if (!ask)
    return (
      <button
        type="button"
        className="btn secondary"
        onClick={() => setAsk(true)}
      >
        もう一度、友達に聞く
      </button>
    );

  return (
    <div className="card stack">
      <p>
        同じ呼び名「<b>{nickname}</b>」で、<b>{targetCount} 人</b>
        に答えてもらう新しい診断をつくります。この結果は消えずに残ります。
      </p>
      <p className="muted small">
        新しい結果が出たら、この端末では前回の結果と並べて見られます（前回のタイプと
        4 つの軸の割合だけを、この端末に覚えておきます）。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn" onClick={create} disabled={busy}>
        {busy ? "つくっています…" : "つくる"}
      </button>
      <button
        type="button"
        className="btn ghost"
        onClick={() => setAsk(false)}
        disabled={busy}
      >
        やめる
      </button>
    </div>
  );
}

// 前回との比較（§4.11）。この端末に前回のまとめがあるときだけ出す
export function PreviousCompare({
  surveyId,
  type,
  axes,
}: {
  surveyId: string;
  type: TypeCode;
  axes: AxisResult[];
}) {
  const records = useAgainRecords();
  const prev = records.find((r) => r.newSurveyId === surveyId);
  if (!prev) return null;
  const prevType = prev.type as TypeCode;
  const day = prev.date ? monthDay(prev.date) : null;
  return (
    <section className="card stack" aria-label="前回との比較">
      <h2 className="section-title">前回との比較</h2>
      <p>
        前回{day ? `（${day}）` : ""}の <b>{getType(prevType).name}</b>（
        {prevType}）→ 今回の <b>{getType(type).name}</b>（{type}）
      </p>
      <ul className="list-plain again-axes">
        {axes.map((a, i) => {
          const p = prev.axes[i] as AxisPoint | undefined;
          if (!p || p.axis !== a.axis) return null;
          const c = axisChange(p, a);
          const name = AXES.find((x) => x.axis === a.axis)?.name;
          return (
            <li key={a.axis}>
              <span className="muted small">{name}</span>　{c.text}
              {c.flipped && (
                <span className="badge again-flip">入れかわり</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        答えた友達や人数が前回とちがうと、結果も変わります。どちらが正しいということではありません。
      </p>
    </section>
  );
}
