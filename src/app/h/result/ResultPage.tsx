"use client";
// 結果発表（仕様書 §4.11・§7）

import { useCallback, useEffect, useState } from "react";
import {
  Disclaimer,
  Header,
  LoadError,
  Loading,
  MissingHost,
} from "@/components/Shell";
import { DeleteSurvey } from "@/components/DeleteSurvey";
import { SupportCard } from "@/components/SupportCard";
import { SpecialShare } from "@/components/SpecialShare";
import dynamic from "next/dynamic";
// くわしい分析は特典を開いた診断だけが使うので、その画面の JS を分けて読む
const DetailedAnalysis = dynamic(
  () => import("@/components/DetailedAnalysis").then((m) => m.DetailedAnalysis),
  { ssr: false },
);
import { FortuneCode } from "@/components/FortuneCode";
import { Meters } from "@/components/Meters";
import { Octopus } from "@/components/Octopus";
import { Reveal } from "@/components/Reveal";
import { Rich } from "@/components/Rich";
import { TypeCard } from "@/components/TypeCard";
import { useHost } from "@/components/useHost";
import { GROUPS, getType, groupOf, matchesOf } from "@/data/framework";
import { hostApi, safeSet, scrollToId, useStoredRaw } from "@/lib/client";
import {
  isLoose,
  shareableSelfType,
  visibleInsights,
  weakAxes,
} from "@/lib/scoring";
import {
  describeInsight,
  describeRelations,
  describeSelfAxis,
  describeTopBehavior,
  fewDataMessage,
  selfSummaryLabel,
} from "@/lib/describe";
import { AskAgain, PreviousCompare } from "./AskAgain";
import { ResultShare } from "./ResultShare";

export function ResultPage() {
  const { state, reload } = useHost();
  const hostKey = state.kind === "ready" ? state.hostKey : null;
  const result = state.kind === "ready" ? state.view.result : null;

  // 演出は結果ごとに最初の 1 回だけ（人数をふやして出し直した結果でも、もう一度出す）。あとから「もう一度」で見られる。
  // 見た結果の人数を覚える（前の版は true を覚えていたので、それは見たものとして扱う）
  const seenRaw = useStoredRaw(`takoshin:revealed:${hostKey ?? ""}`);
  const [override, setOverride] = useState<boolean | null>(null);
  const reveal =
    override ??
    (hostKey !== null &&
      result !== null &&
      (seenRaw === null ||
        (seenRaw !== "true" && seenRaw !== JSON.stringify(result.n))));
  const shownN = result?.n ?? null;
  const endReveal = useCallback(() => {
    if (hostKey) safeSet(`takoshin:revealed:${hostKey}`, shownN ?? true);
    setOverride(false);
    window.scrollTo(0, 0);
  }, [hostKey, shownN]);

  // 結果を表示したことを数える。診断ごとに最初の 1 回だけ、サーバーで数える（§11.11）
  const resultReady = hostKey !== null && result !== null;
  useEffect(() => {
    if (!resultReady || !hostKey) return;
    void hostApi("/event", hostKey, {
      method: "POST",
      body: JSON.stringify({ event: "result_view" }),
    }).catch(() => null);
  }, [resultReady, hostKey]);

  if (state.kind === "loading") return <Loading />;
  if (state.kind === "error") return <LoadError onRetry={reload} />;
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
  const top = view.topBehaviors;
  // 人数が少なく、匿名性の決まりで問ごとの分析を出せないことがあると伝える（§4.11）
  const fewData = fewDataMessage(
    result.n,
    result.insights,
    top,
    relations !== null,
  );
  // うなずいた行動の一覧に出す問は、データでわかるあなたの D5 から外す（同じ行動を 2 回出さない。§7.5）
  const insights = visibleInsights(result.insights, top);
  const daysLeft = view.daysLeft;
  const vars = {
    ["--gc" as string]: group.ink,
    ["--gg" as string]: group.glow,
  };

  return (
    <main className="page wide stack" style={vars}>
      {reveal && <Reveal code={result.type} n={result.n} onEnd={endReveal} />}
      {/* 画面の見出しはタイプのカードが担うので、読み上げ用にだけページの見出しを置く */}
      <h1 className="visually-hidden">{view.nickname}の結果</h1>
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

      {/* パソコンでは 2 列：左にタイプと 4 つの軸（スクロールしても残す）、右にくわしい中身 */}
      <div className="result-grid">
        <div className={`result-side stack${result.self ? " tall" : ""}`}>
          <TypeCard
            code={result.type}
            ties={result.axes.map((a) => a.tie)}
            weak={weakAxes(result.axes)}
            loose={isLoose(result.axes)}
            lead={`${view.nickname}は友達 ${result.n} 人から見ると`}
          />
          {/* 気分が高いうちにシェアできるよう、カードのすぐ下からシェアの欄へ飛べるようにする */}
          <button
            type="button"
            className="btn secondary"
            onClick={() => scrollToId("share")}
          >
            結果をシェアする
          </button>

          {/* 自分で答えた人は、4 つの軸を「周りと自分の比較」にまとめる（同じ帯を 2 回見せない） */}
          {result.self ? (
            <section className="card stack">
              <h2 className="section-title">周りと自分の比較</h2>
              {/* ど真ん中の軸があると 4 文字が決まらないので、そのときは出さない */}
              {!result.self.axes.some((a) => a.tie) && (
                <p>
                  自分で思うタイプ：<b>{getType(result.self.type).name}</b>（
                  {result.self.type}）
                </p>
              )}
              {selfSummaryLabel(result.self, result.axes) && (
                <p>
                  <span className="badge">
                    {selfSummaryLabel(result.self, result.axes)}
                  </span>
                </p>
              )}
              <Meters
                axes={result.axes}
                self={result.self.axes}
                spreads={view.spreads}
              />
              <ul className="list-plain">
                {result.self.axes.map((s, i) => (
                  <li key={s.axis} className="insight">
                    <span>
                      <Rich
                        text={describeSelfAxis(
                          s,
                          result.axes[i].pole,
                          result.axes[i].percent,
                          result.axes[i].tie,
                        )}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="card stack">
              <h2 className="section-title">4 つの軸</h2>
              <Meters axes={result.axes} spreads={view.spreads} />
            </section>
          )}
          {/* 「もう一度、友達に聞く」で作った診断なら、この端末に覚えた前回の結果と比べる（§4.11） */}
          <PreviousCompare
            surveyId={view.surveyId}
            type={result.type}
            axes={result.axes}
          />
        </div>
        <div className="result-main stack">
          {/* 友達の答えから計算した部分を先に、タイプごとに決まった文をそのあとに置く（§4.11） */}
          {insights.length > 0 && (
            <details className="card" open>
              <summary>データでわかるあなた</summary>
              <div>
                <ul className="list-plain">
                  {insights.map((ins, i) => (
                    <li key={i} className="insight">
                      <span>
                        <Rich
                          text={
                            describeInsight(
                              ins,
                              result.algorithmVersion,
                              result.axes,
                            ).text
                          }
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}

          {/* 友達の答えから選んだ、多くの友達が「そう思う」と答えた行動（§4.11・§7.5）。1 つもなければ出さない */}
          {top && top.length > 0 && (
            <details className="card" open>
              <summary>友達の多くがうなずいた行動</summary>
              <div className="stack">
                <ul className="list-plain">
                  {top.map((b) => {
                    const line = describeTopBehavior(b, result.n, result.axes);
                    return (
                      <li key={b.no} className="insight">
                        <span>
                          <b>{b.summary}</b>
                          <br />
                          <span className="small">{line.count}</span>
                          {line.note && (
                            <>
                              <br />
                              <span className="small muted">
                                <Rich text={line.note} />
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="muted small">
                  「わからない」の人を除いて、3 分の 2
                  以上の友達が「そう思う」の側を選んだ行動を、「そう思う」の割合が高い順に
                  3 つまで出しています。
                </p>
              </div>
            </details>
          )}

          {fewData && (
            <section className="card stack-tight">
              <p className="small">{fewData}</p>
              {view.raiseMin !== null && (
                <p className="small">
                  <button
                    type="button"
                    className="link-btn"
                    style={{ textDecoration: "underline" }}
                    onClick={() => scrollToId("ask-more")}
                  >
                    人数をふやすには（ページの下へ）
                  </button>
                </p>
              )}
            </section>
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

          <section className="card stack">
            {/* ここはタイプごとに決まった文。友達の答えから計算した部分（データでわかるあなた）と分ける */}
            <h2 className="section-title">
              {type.name}タイプは、こう見られやすい
            </h2>
            <p>{type.friendView}</p>
            <p className="muted small">友達から見たあるある</p>
            <div className="aruaru" aria-label="友達から見たあるある">
              {type.aruaru.map((a) => (
                <span key={a}>#{a}</span>
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

          {view.fortuneCode && <FortuneCode code={view.fortuneCode} />}
          {view.analysis && view.reading && (
            <DetailedAnalysis
              code={result.type}
              n={result.n}
              axes={result.axes}
              spreads={view.spreads}
              analysis={view.analysis}
              reading={view.reading}
            />
          )}

          <section id="share" className="card stack">
            <h2 className="section-title">シェア</h2>
            <ResultShare
              hostKey={state.hostKey}
              code={result.type}
              selfType={shareableSelfType(result.self)}
              n={result.n}
              shareId={view.shareId}
              onShareChange={() => void reload()}
            />
          </section>

          {/* スペシャルな画像は応援した人だけ。「応援する」を押しただけなら応援の欄の 2 段目に、支払いが済んだらここに出す */}
          {view.premium && <SpecialShare hostKey={state.hostKey} />}

          <SupportCard
            code={result.type}
            n={result.n}
            hostKey={state.hostKey}
            offer={view.offer}
            supporters={view.supporters}
            premium={view.premium}
            gifted={view.gifted}
            daysLeft={view.daysLeft}
            deleteAt={view.deleteAt}
            onChange={() => void reload()}
          />

          <section id="ask-more" className="stack">
            {/* 同じ呼び名・同じ人数で、新しく聞き直す（§4.11） */}
            <AskAgain
              surveyId={view.surveyId}
              nickname={view.nickname}
              targetCount={view.targetCount}
              type={result.type}
              axes={result.axes}
              completedAt={view.completedAt}
            />
            {view.raiseMin !== null && (
              <div className="stack-tight">
                <a href={`/h/more#${state.hostKey}`} className="btn secondary">
                  人数をふやして、もっと聞く
                </a>
                <p className="muted small">
                  この診断に答える人を足します。いまの結果は、人数がそろって出し直すまで見られなくなります。
                </p>
              </div>
            )}
            {daysLeft !== null && (
              <p className="muted small center">
                この結果は、あと {daysLeft} 日で自動的に消えます。
              </p>
            )}
            <DeleteSurvey hostKey={state.hostKey} premium={view.premium} />
            <Disclaimer />
          </section>
        </div>
      </div>
    </main>
  );
}
