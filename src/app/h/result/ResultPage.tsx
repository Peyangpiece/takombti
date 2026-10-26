"use client";
// 結果発表（仕様書 §4.11・§7）

import { useCallback, useState } from "react";
import { Disclaimer, Header, Loading, MissingHost } from "@/components/Shell";
import { DeleteSurvey } from "@/components/DeleteSurvey";
import { SupportCard } from "@/components/SupportCard";
import { DetailedAnalysis } from "@/components/DetailedAnalysis";
import { Meters } from "@/components/Meters";
import { Octopus } from "@/components/Octopus";
import { Reveal } from "@/components/Reveal";
import { Rich } from "@/components/Rich";
import { TypeCard } from "@/components/TypeCard";
import { useHost } from "@/components/useHost";
import { GROUPS, getType, groupOf, matchesOf } from "@/data/framework";
import { safeSet, useStoredRaw } from "@/lib/client";
import {
  describeInsight,
  describeRelations,
  describeSelfAxis,
  selfSummaryLabel,
} from "@/lib/describe";
import { ResultShare } from "./ResultShare";

export function ResultPage() {
  const { state, reload } = useHost();
  const hostKey = state.kind === "ready" ? state.hostKey : null;
  const result = state.kind === "ready" ? state.view.result : null;

  // 演出は最初の 1 回だけ。あとから「もう一度」で見られる
  const seenRaw = useStoredRaw(`takoshin:revealed:${hostKey ?? ""}`);
  const [override, setOverride] = useState<boolean | null>(null);
  const reveal =
    override ?? (hostKey !== null && result !== null && seenRaw === null);
  const endReveal = useCallback(() => {
    if (hostKey) safeSet(`takoshin:revealed:${hostKey}`, true);
    setOverride(false);
    window.scrollTo(0, 0);
  }, [hostKey]);

  if (state.kind === "loading") return <Loading />;
  if (state.kind !== "ready") return <MissingHost />;
  const { view } = state;
  if (!result) {
    return (
      <main className="page stack center" style={{ paddingTop: 48 }}>
        <Header />
        <h1>まだ結果は出ていません</h1>
        <p>
          {view.targetCount} 人そろったら結果が出ます（いま {view.responseCount}{" "}
          人）。
        </p>
        <a href={`/h#${state.hostKey}`} className="btn">
          回答状況を見る
        </a>
      </main>
    );
  }

  const type = getType(result.type);
  const group = GROUPS[groupOf(result.type)];
  const { easy, spark } = matchesOf(result.type);
  const relations = describeRelations(result);
  const daysLeft = view.daysLeft;
  const vars = {
    ["--gc" as string]: group.ink,
    ["--gg" as string]: group.glow,
  };

  return (
    <main className="page stack" style={vars}>
      {reveal && <Reveal code={result.type} n={result.n} onEnd={endReveal} />}
      <Header
        right={
          <button
            type="button"
            className="btn ghost small"
            style={{ width: "auto" }}
            onClick={() => setOverride(true)}
          >
            発表をもう一度見る
          </button>
        }
      />

      <TypeCard
        code={result.type}
        ties={result.axes.map((a) => a.tie)}
        lead={`${view.nickname}は友達 ${result.n} 人から見ると`}
      />

      <section className="card stack">
        <h2 className="section-title">4 つの軸</h2>
        <Meters axes={result.axes} />
      </section>

      <section className="card stack">
        <h2 className="section-title">友達から見たあなた</h2>
        <p>{type.friendView}</p>
        <div className="aruaru" aria-label="友達のあるある">
          {type.aruaru.map((a) => (
            <span key={a}>「{a}」</span>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2 className="section-title">強み</h2>
        <ul className="list-plain">
          {type.strengths.map((s) => (
            <li key={s.title}>
              <b className="text-group">{s.title}</b>
              <p>{s.text}</p>
            </li>
          ))}
        </ul>
        <h2 className="section-title">ちょっと気をつけたいところ</h2>
        <ul className="list-plain">
          {type.cautions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <details className="card" open>
        <summary>データでわかるあなた</summary>
        <div>
          <ul className="list-plain">
            {result.insights.map((ins, i) => (
              <li key={i} className="insight">
                <span>
                  <Rich
                    text={describeInsight(ins, result.algorithmVersion).text}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {result.self && (
        <details className="card">
          <summary>自分 vs 周り</summary>
          <div className="stack">
            <p>
              自分で思うタイプ：<b>{getType(result.self.type).name}</b>（
              {result.self.type}）
            </p>
            {selfSummaryLabel(result.self.summary) && (
              <p>
                <span className="badge">
                  {selfSummaryLabel(result.self.summary)}
                </span>
              </p>
            )}
            <Meters axes={result.axes} self={result.self.axes} />
            <ul className="list-plain">
              {result.self.axes.map((s, i) => (
                <li key={s.axis} className="insight">
                  <span>
                    <Rich
                      text={describeSelfAxis(
                        s,
                        result.axes[i].pole,
                        result.axes[i].percent,
                      )}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {relations && (
        <details className="card">
          <summary>関係ごとの見え方</summary>
          <div className="stack">
            <p>
              <Rich text={relations} />
            </p>
            <p className="muted small">
              同じ関係の人が 3 人以上いる関係だけを出しています。
            </p>
          </div>
        </details>
      )}

      <details className="card">
        <summary>おまけ：相性のいいタイプ</summary>
        <div className="stack">
          <div className="match">
            {[
              ["一緒にいるとラク", easy],
              ["刺激をくれる", spark],
            ].map(([label, code]) => (
              <div key={label}>
                <p className="small muted">{label}</p>
                <Octopus code={code} size={64} />
                <p style={{ fontWeight: 900 }}>{code}</p>
                <p className="small" style={{ fontWeight: 700 }}>
                  {getType(code as typeof easy).name}
                </p>
              </div>
            ))}
          </div>
          <p className="muted small">
            遊びの決まりで選んでいます。相性に正解はありません。
          </p>
        </div>
      </details>

      {view.analysis && <DetailedAnalysis analysis={view.analysis} />}

      <section className="card stack">
        <h2 className="section-title">シェア</h2>
        <ResultShare
          hostKey={state.hostKey}
          code={result.type}
          n={result.n}
          shareId={view.shareId}
          premium={view.premium}
          onShareChange={() => void reload()}
        />
      </section>

      <SupportCard
        code={result.type}
        n={result.n}
        hostKey={state.hostKey}
        offer={view.offer}
        premium={view.premium}
      />

      <section className="stack">
        {view.raiseMin !== null && (
          <a href={`/h/more#${state.hostKey}`} className="btn secondary">
            人数をふやして、もっと聞く
          </a>
        )}
        {daysLeft !== null && (
          <p className="muted small center">
            この結果は、あと {daysLeft} 日で自動的に消えます。
          </p>
        )}
        <DeleteSurvey hostKey={state.hostKey} />
        <Disclaimer />
      </section>
    </main>
  );
}
