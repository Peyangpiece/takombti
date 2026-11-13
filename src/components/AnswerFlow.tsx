"use client";
// 1 画面 1 問の回答（仕様書 §4.8・§4.9・§10）。回答者と自己回答で共用する。
// 出す問は基本の 16 問（§3.5）。半々に近い軸の深掘りの問は、答える人が「もっと答える」を選んだとき（more）だけ足す。
// 「わからない」が多くて基本の問だけでは判定できない軸の深掘りは、選ばなくても足す。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CORE_ORDER,
  QUESTIONS,
  questionText,
  type Scene,
} from "../data/questions";
import {
  incompleteAxes,
  MIN_ANSWERED_PER_AXIS,
  NOT_ASKED,
  plannedQuestions,
  UNKNOWN,
} from "../lib/scoring";
import { vibrate } from "../lib/client";
import { Octopus } from "./Octopus";

// 問の番号順の答え（null はまだ答えていない）
export type Draft = (number | null)[];

export const emptyDraft = (): Draft => Array(QUESTIONS.length).fill(null);

// 送る形にする：出した問の「まだ」は「わからない」、出していない問は NOT_ASKED
export function finalize(draft: Draft, more = false): number[] {
  const plan = new Set(plannedQuestions(draft, more));
  return draft.map((a, i) =>
    plan.has(i + 1) ? (a === null || a === NOT_ASKED ? UNKNOWN : a) : NOT_ASKED,
  );
}

interface Props {
  name: string | null; // null なら自己回答
  scene: Scene;
  initial: Draft;
  initialIndex?: number;
  allowUnknown: boolean;
  // 半々に近い軸の深掘りの問も出すか（§3.5。答える人が確認の画面で「もっと答える」を選んだとき）
  more?: boolean;
  onChange: (answers: Draft, index: number) => void;
  onBack: () => void;
  onDone: (answers: number[]) => void;
}

const LABELS = ["ちがう", "", "", "どちらとも言えない", "", "", "そう思う"];
const SIZES = [52, 44, 38, 30, 38, 44, 52];
const CHEERS: Record<number, string> = {
  4: "いいペース！",
  8: "あと半分！",
  // 「わからない」が多いと深掘りの問が足されることがあるので、「ラスト」とは言わない（§4.8）
  12: "あと 4 問！",
};
const ADVANCE_MS = 250;
// 1 問にかかる目安（基本の 16 問で約 3 分）
const SECONDS_PER_QUESTION = 11;

// 深掘りの問が増えたときだけ、残りの目安時間を出す（最初の「約 3 分」より長くなるため。§4.8）
export function remainingHint(
  planned: number,
  answered: number,
): string | null {
  const left = planned - answered;
  if (planned <= CORE_ORDER.length || left <= 0) return null;
  const sec = left * SECONDS_PER_QUESTION;
  if (sec < 45) return "もうすぐ終わり";
  return `あと ${Math.round(sec / 60)} 分ほど`;
}

// 深掘りの前にはさむ画面の「約 N 分」（§4.8）。1 問 11 秒で数え、1 分より短くても「約 1 分」
export function extraMinutes(count: number): number {
  return Math.max(1, Math.round((count * SECONDS_PER_QUESTION) / 60));
}

// 番号と進み具合の帯（§4.8）。基本の問は「n / 16」、深掘りの問は「追加 n / 足した数」と数え直す。
// 「わからない」が多くて判定できない軸の問へ戻ったとき（fix）は、その場面だけの「n / 戻った数」。
// 帯は番号と同じ位置まで伸ばす（「16 / 16」で帯がいっぱいになる）
export function progressOf(
  pos: number,
  planLength: number,
  fix: { done: number; total: number } | null,
): { label: string; value: number; max: number } {
  if (fix)
    return {
      label: `${Math.min(fix.done + 1, fix.total)} / ${fix.total}`,
      value: Math.min(fix.done + 1, fix.total),
      max: fix.total,
    };
  const core = CORE_ORDER.length;
  if (planLength > core && pos >= core) {
    const extra = planLength - core;
    return {
      label: `追加 ${pos - core + 1} / ${extra}`,
      value: Math.min(pos - core + 1, extra),
      max: extra,
    };
  }
  return {
    label: `${pos + 1} / ${Math.min(planLength, core)}`,
    value: Math.min(pos + 1, core),
    max: Math.min(planLength, core),
  };
}

// 深掘りの問に答えかけているか。「もっと答える」を選んだ印がない答えかけ（この決まりより前に保存したもの・
// 前に保存した自己回答）でも、答えた深掘りの問を捨てずに続きから答えられるようにする
export function hasFollowAnswers(draft: Draft): boolean {
  return QUESTIONS.some(
    (q) =>
      q.stage !== "core" &&
      draft[q.no - 1] != null &&
      draft[q.no - 1] !== NOT_ASKED,
  );
}

// 確認の画面（§4.9）の「32 問に答えました（わからない 3 問）。」。answers は送る形（finalize のあと）
export function answeredSummary(answers: number[]): string {
  const asked = answers.filter((a) => a !== NOT_ASKED).length;
  const unknown = answers.filter((a) => a === UNKNOWN).length;
  return `${asked} 問に答えました${unknown > 0 ? `（わからない ${unknown} 問）` : ""}。`;
}

// 判定できない軸を判定できるようにするのに、あと何問「わからない」以外で答えればよいか（§3.4）
export function missingAnswers(answers: number[]): number {
  return incompleteAxes(answers).reduce(
    (n, axis) =>
      n +
      Math.max(
        0,
        MIN_ANSWERED_PER_AXIS -
          QUESTIONS.filter(
            (x) =>
              x.axis === axis &&
              answers[x.no - 1] >= 1 &&
              answers[x.no - 1] <= 7,
          ).length,
      ),
    0,
  );
}

// 文字を打つ欄（入力欄・複数行の欄・選ぶ欄・書ける部分）か。ラジオボタンやボタンは含めない
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement))
    return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["radio", "checkbox", "button", "submit", "reset", "range"].includes(
    type,
  );
}

function dotColor(i: number): string {
  if (i < 3) return "var(--left)";
  if (i === 3) return "var(--mid)";
  return "var(--brand)";
}

export function AnswerFlow({
  name,
  scene,
  initial,
  initialIndex = 0,
  allowUnknown,
  more = false,
  onChange,
  onBack,
  onDone,
}: Props) {
  const [answers, setAnswers] = useState<Draft>(initial);
  const plan = useMemo(() => plannedQuestions(answers, more), [answers, more]);
  // index は「出す問の並び（plan）」の中の位置
  const [index, setIndex] = useState(() =>
    Math.min(initialIndex, plannedQuestions(initial, more).length - 1),
  );
  const [pop, setPop] = useState<number | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  // 判定できない軸の「わからない」の問へ戻っているとき、戻った時点で足りなかった問の数（§3.4・§4.9）
  const [fixTotal, setFixTotal] = useState<number | null>(null);
  // 基本の問のあと、深掘りの問の前にはさむ画面を出しているか（§4.8）
  const [gate, setGate] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);
  const pos = Math.min(index, plan.length - 1);
  const q = QUESTIONS[plan[pos] - 1];

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const finish = useCallback(
    (list: Draft) => {
      const order = plannedQuestions(list, more);
      const firstEmpty = order.findIndex((no) => list[no - 1] === null);
      if (firstEmpty >= 0) {
        setFixTotal(null);
        setIndex(firstEmpty);
        return;
      }
      const filled = finalize(list, more);
      const missing = incompleteAxes(filled);
      if (missing.length > 0) {
        // 判定できない軸があれば、その軸の「わからない」の問へ戻る（§3.4）
        const axis = missing[0];
        const target = order.findIndex(
          (no) => QUESTIONS[no - 1].axis === axis && filled[no - 1] === UNKNOWN,
        );
        setFixTotal((t) => t ?? missingAnswers(filled));
        setIndex(target);
        return;
      }
      setFixTotal(null);
      onDone(filled);
    },
    [onDone, more],
  );

  const choose = useCallback(
    (value: number) => {
      if (timer.current) clearTimeout(timer.current);
      const next = [...answers];
      next[q.no - 1] = value;
      setAnswers(next);
      setPop(value);
      vibrate();
      const before = plan.length;
      const nextPlan = plannedQuestions(next, more);
      const answeredCount = nextPlan.filter(
        (no) => next[no - 1] !== null,
      ).length;
      const wasNew = answers[q.no - 1] === null;
      // 選んだ答えはすぐに保存する（0.25 秒のうちに「←」で戻られても、答えを失わないように）
      onChange(next, pos);
      timer.current = setTimeout(() => {
        timer.current = null;
        setPop(null);
        const nextIndex = pos + 1;
        if (fixTotal !== null || nextIndex >= nextPlan.length) {
          onChange(next, pos);
          finish(next);
          return;
        }
        // 基本の問を答え終えて深掘りの問が増えたときは、問に重ねて知らせず、1 枚はさむ（§4.8）
        if (wasNew && nextPlan.length > before) {
          setGate(true);
        } else if (wasNew && CHEERS[answeredCount]) {
          setCheer(CHEERS[answeredCount]);
          setTimeout(() => setCheer(null), 1200);
        }
        setIndex(nextIndex);
        onChange(next, nextIndex);
      }, ADVANCE_MS);
    },
    [answers, plan, pos, q, fixTotal, more, onChange, finish],
  );

  const prev = useCallback(() => {
    // 次の問へ進む待ちを取り消す（答えは選んだときに保存済み）。ふくらみも戻す
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      setPop(null);
    }
    // 戻ったら、判定できない軸の案内はやめる（最後まで進めば、もう一度案内する）
    setFixTotal(null);
    if (gate) {
      setGate(false);
      setIndex(CORE_ORDER.length - 1);
    } else if (pos === 0) onBack();
    else setIndex(pos - 1);
  }, [pos, gate, onBack]);

  const forward = useCallback(() => {
    if (gate) return setGate(false);
    if (answers[q.no - 1] === null) return;
    if (pos + 1 >= plan.length || fixTotal !== null) finish(answers);
    else setIndex(pos + 1);
  }, [answers, q, pos, plan, gate, fixTotal, finish]);

  // キーボード（§10.2）：数字キー 1〜7 で選ぶ・0 で「わからない」・←→ で前後の問。
  // ↑↓ は、丸（ラジオボタン）にフォーカスがあるときだけ前後の問に使う（ラジオ本来の ↑↓ は隣の丸を選び、
  // 選ぶと自動で次の問へ進んでしまうため）。それ以外の場所の ↑↓ は、ページのスクロールのために残す。
  // 修飾キー付き（Shift・Ctrl・⌘・Alt）と、文字を打つ欄の中では何もしない。深掘りの前の画面では数字キーを使わない
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      const onScale =
        e.target instanceof HTMLInputElement && e.target.type === "radio";
      if (/^[1-7]$/.test(e.key) && !gate) choose(Number(e.key));
      else if (e.key === "0" && allowUnknown && !gate) choose(UNKNOWN);
      else if (e.key === "ArrowLeft" || (e.key === "ArrowUp" && onScale))
        prev();
      else if (e.key === "ArrowRight" || (e.key === "ArrowDown" && onScale))
        forward();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, prev, forward, allowUnknown, gate]);

  // 問が変わったら、読み上げとキーボードの位置を問の文へ移す（画面の読み上げで、新しい問が読まれるように）
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [q.no, gate]);

  const back = (
    <button
      type="button"
      className="icon-btn"
      onClick={prev}
      aria-label="前の質問へ"
    >
      ←
    </button>
  );

  // 深掘りの問の前の 1 枚（§4.8）。足した問の数と目安の時間を、問に重ねずに知らせる
  if (gate) {
    const extra = plan.length - CORE_ORDER.length;
    return (
      <div className="stack">
        <div className="q-top">
          {back}
          <div className="q-count">基本の質問は終わり</div>
          <span />
        </div>
        <div className="q-body stack center deep-gate">
          <Octopus code="INTP" size={96} className="bob" />
          <h1 ref={heading} tabIndex={-1}>
            もう少しだけ、
            <wbr />
            聞かせてください
          </h1>
          <p className="deep-gate-count">
            追加の質問 {extra} 問（約 {extraMinutes(extra)} 分）
          </p>
          <p className="muted small">
            {more
              ? "どちらとも決めにくかったところを、別の場面で聞きます。"
              : "「わからない」が多かったところを、別の場面で聞きます。"}
          </p>
          <button type="button" className="btn" onClick={() => setGate(false)}>
            続ける
          </button>
        </div>
      </div>
    );
  }

  // 回答者向けの文は「{name}は、…」の形なので、呼び名を色付きで先頭に出す
  const rest =
    name === null ? q.selfText : questionText(q, scene).replace("{name}", "");
  const answeredCount = plan.filter((no) => answers[no - 1] !== null).length;
  const current = answers[q.no - 1];
  const fix =
    fixTotal === null
      ? null
      : {
          total: fixTotal,
          done: Math.max(0, fixTotal - missingAnswers(finalize(answers, more))),
        };
  const progress = progressOf(pos, plan.length, fix);
  const hint = fix ? null : remainingHint(plan.length, answeredCount);

  return (
    <div className="stack">
      <div className="q-top">
        {back}
        <div>
          <div className="q-count" aria-live="polite">
            {progress.label}
            {cheer ? (
              <span className="q-cheer">・{cheer}</span>
            ) : (
              hint && <span className="q-hint">・{hint}</span>
            )}
          </div>
          {/* 帯の先に、タコを歩かせる（かざり。数字は上の「n / 16」と読み上げ用の値で伝える） */}
          <div className="progress-wrap">
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.max}
              aria-valuenow={progress.value}
              aria-label="進み具合"
            >
              <div
                style={{ width: `${(progress.value / progress.max) * 100}%` }}
              />
            </div>
            <div className="progress-tako" aria-hidden="true">
              <Octopus
                size={26}
                style={{ left: `${(progress.value / progress.max) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={forward}
          disabled={current === null}
          aria-label="次の質問へ"
        >
          →
        </button>
      </div>

      {fix && (
        <p className="notice" role="status">
          結果を出すには、あと {Math.max(1, fix.total - fix.done)}{" "}
          問、「わからない」以外で近いほうを選んでほしい質問があります。
        </p>
      )}

      <div
        className="q-body"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (dx > 60) prev();
          else if (dx < -60) forward();
        }}
      >
        <h1
          key={q.no}
          ref={heading}
          tabIndex={-1}
          className="q-text q-anim"
          id={`q-${q.no}`}
        >
          <span>
            {name !== null && <span className="name">{name}</span>}
            {rest}
          </span>
        </h1>

        <div className="scale-wrap">
          <fieldset className="scale" aria-labelledby={`q-${q.no}`}>
            {SIZES.map((sz, i) => {
              const value = i + 1;
              return (
                <label
                  key={value}
                  className={`dot${pop === value ? " pop" : ""}`}
                >
                  <input
                    type="radio"
                    name={`q${q.no}`}
                    value={value}
                    checked={current === value}
                    onChange={() => choose(value)}
                    onClick={() => current === value && choose(value)}
                    aria-label={`${value} ${LABELS[i] || ""}`.trim()}
                  />
                  <span
                    style={{
                      ["--sz" as string]: `${sz}px`,
                      ["--c" as string]: dotColor(i),
                    }}
                  />
                </label>
              );
            })}
          </fieldset>
          <div className="ends" aria-hidden="true">
            <span>{LABELS[0]}</span>
            <span className="mid">{LABELS[3]}</span>
            <span>{LABELS[6]}</span>
          </div>
        </div>

        {allowUnknown && (
          <button
            type="button"
            className="btn ghost"
            aria-pressed={current === UNKNOWN}
            onClick={() => choose(UNKNOWN)}
            style={
              current === UNKNOWN
                ? { color: "var(--brand)", fontWeight: 800 }
                : undefined
            }
          >
            わからない
          </button>
        )}
      </div>
    </div>
  );
}
