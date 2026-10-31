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
import { isLoose, shareableSelfType, weakAxes } from "@/lib/scoring";
import {
  describeInsight,
  describeRelations,
  describeSelfAxis,
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
          <section className="card stack">
            {/* ここはタイプごとに決まった文。友達の答えから計算した部分（データでわかるあなた）と分ける */}
            <h2 className="section-title">
              {type.name}タイプは、こう見られやすい
            </h2>
            <p>{type.friendView}</p>
            <p className="muted small">このタイプが言われがちな一言</p>
            <div className="aruaru" aria-label="このタイプが言われがちな一言">
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
          {view.premium && (
            <SpecialShare hostKey={state.hostKey} code={result.type} />
          )}

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

          <section className="stack">
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
              <a href={`/h/more#${state.hostKey}`} className="btn secondary">
                人数をふやして、もっと聞く
              </a>
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
