"use client";
// 1 画面 1 問の回答（仕様書 §4.8・§4.9・§10）。回答者と自己回答で共用する。
// 出す問は答えによって変わる（§3.5）：基本の 16 問のあと、半々に近い軸だけ深掘りの問を足す。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CORE_ORDER,
  QUESTIONS,
  questionText,
  type Scene,
} from "../data/questions";
import { AXES } from "../data/framework";
import {
  incompleteAxes,
  MIN_ANSWERED_PER_AXIS,
  NOT_ASKED,
  plannedQuestions,
  UNKNOWN,
} from "../lib/scoring";
import { vibrate } from "../lib/client";

// 問の番号順の答え（null はまだ答えていない）
export type Draft = (number | null)[];

export const emptyDraft = (): Draft => Array(QUESTIONS.length).fill(null);

// 送る形にする：出した問の「まだ」は「わからない」、出していない問は NOT_ASKED
export function finalize(draft: Draft): number[] {
  const plan = new Set(plannedQuestions(draft));
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
  onChange: (answers: Draft, index: number) => void;
  onBack: () => void;
  onDone: (answers: number[]) => void;
}

const LABELS = ["ちがう", "", "", "どちらとも", "", "", "そう"];
const SIZES = [52, 44, 38, 30, 38, 44, 52];
const CHEERS: Record<number, string> = {
  4: "いいペース！",
  8: "あと半分！",
  12: "ラスト 4 問！",
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
  onChange,
  onBack,
  onDone,
}: Props) {
  const [answers, setAnswers] = useState<Draft>(initial);
  const plan = useMemo(() => plannedQuestions(answers), [answers]);
  // index は「出す問の並び（plan）」の中の位置
  const [index, setIndex] = useState(() =>
    Math.min(initialIndex, plannedQuestions(initial).length - 1),
  );
  const [pop, setPop] = useState<number | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const [needAxis, setNeedAxis] = useState<string | null>(null);
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
      const order = plannedQuestions(list);
      const firstEmpty = order.findIndex((no) => list[no - 1] === null);
      if (firstEmpty >= 0) {
        setIndex(firstEmpty);
        return;
      }
      const filled = finalize(list);
      const missing = incompleteAxes(filled);
      if (missing.length > 0) {
        // 判定できない軸があれば、その軸の「わからない」の問へ戻る（§3.4）
        const axis = missing[0];
        const target = order.findIndex(
          (no) => QUESTIONS[no - 1].axis === axis && filled[no - 1] === UNKNOWN,
        );
        setNeedAxis(axis);
        setIndex(target);
        return;
      }
      setNeedAxis(null);
      onDone(filled);
    },
    [onDone],
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
      const nextPlan = plannedQuestions(next);
      const answeredCount = nextPlan.filter(
        (no) => next[no - 1] !== null,
      ).length;
      const wasNew = answers[q.no - 1] === null;
      if (needAxis && incompleteAxes(finalize(next)).length === 0) {
        setNeedAxis(null);
      }
      // 選んだ答えはすぐに保存する（0.25 秒のうちに「←」で戻られても、答えを失わないように）
      onChange(next, pos);
      timer.current = setTimeout(() => {
        timer.current = null;
        setPop(null);
        let message: string | null = null;
        // 基本の問を答え終えて、深掘りの問が増えたとき
        if (wasNew && nextPlan.length > before) {
          message = `もう少しだけ！ あと ${nextPlan.length - before} 問`;
        } else if (
          wasNew &&
          CHEERS[answeredCount] &&
          answeredCount < nextPlan.length
        ) {
          message = CHEERS[answeredCount];
        }
        if (message) {
          setCheer(message);
          setTimeout(() => setCheer(null), 1200);
        }
        const nextIndex = pos + 1;
        if (nextIndex >= nextPlan.length || needAxis) {
          onChange(next, pos);
          finish(next);
        } else {
          setIndex(nextIndex);
          onChange(next, nextIndex);
        }
      }, ADVANCE_MS);
    },
    [answers, plan, pos, q, needAxis, onChange, finish],
  );

  const prev = useCallback(() => {
    // 次の問へ進む待ちを取り消す（答えは選んだときに保存済み）。ふくらみも戻す
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      setPop(null);
    }
    if (pos === 0) onBack();
    else setIndex(pos - 1);
  }, [pos, onBack]);

  const forward = useCallback(() => {
    if (answers[q.no - 1] === null) return;
    if (pos + 1 >= plan.length) finish(answers);
    else setIndex(pos + 1);
  }, [answers, q, pos, plan, finish]);

  // キーボード（§10.2）：数字キー 1〜7 で選ぶ・0 で「わからない」・←→ で前後の問。
  // ↑↓ は、丸（ラジオボタン）にフォーカスがあるときだけ前後の問に使う（ラジオ本来の ↑↓ は隣の丸を選び、
  // 選ぶと自動で次の問へ進んでしまうため）。それ以外の場所の ↑↓ は、ページのスクロールのために残す。
  // 修飾キー付き（Shift・Ctrl・⌘・Alt）と、文字を打つ欄の中では何もしない
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      const onScale =
        e.target instanceof HTMLInputElement && e.target.type === "radio";
      if (/^[1-7]$/.test(e.key)) choose(Number(e.key));
      else if (e.key === "0" && allowUnknown) choose(UNKNOWN);
      else if (e.key === "ArrowLeft" || (e.key === "ArrowUp" && onScale))
        prev();
      else if (e.key === "ArrowRight" || (e.key === "ArrowDown" && onScale))
        forward();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, prev, forward, allowUnknown]);

  // 問が変わったら、読み上げとキーボードの位置を問の文へ移す（画面の読み上げで、新しい問が読まれるように）
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [q.no]);

  // 回答者向けの文は「{name}は、…」の形なので、呼び名を色付きで先頭に出す
  const rest =
    name === null ? q.selfText : questionText(q, scene).replace("{name}", "");
  const answeredCount = plan.filter((no) => answers[no - 1] !== null).length;
  const current = answers[q.no - 1];
  const hint = remainingHint(plan.length, answeredCount);

  return (
    <div className="stack">
      <div className="q-top">
        <button
          type="button"
          className="icon-btn"
          onClick={prev}
          aria-label="前の質問へ"
        >
          ←
        </button>
        <div>
          <div className="q-count" aria-live="polite">
            {pos + 1} / {plan.length}
            {hint && <span className="q-hint">・{hint}</span>}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={plan.length}
            aria-valuenow={answeredCount}
            aria-label="答えた数"
          >
            <div style={{ width: `${(answeredCount / plan.length) * 100}%` }} />
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

      {needAxis && (
        <p className="notice" role="status">
          「{AXES.find((a) => a.axis === needAxis)!.name}」の質問は、あと{" "}
          {Math.max(
            1,
            MIN_ANSWERED_PER_AXIS -
              QUESTIONS.filter(
                (x) =>
                  x.axis === needAxis &&
                  (answers[x.no - 1] ?? 0) >= 1 &&
                  (answers[x.no - 1] ?? 0) <= 7,
              ).length,
          )}{" "}
          つ答えてね。わからないものが多いと判定できないので、近いほうを選んでください
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
            <span>ちがう</span>
            <span className="mid">どちらとも</span>
            <span>そう</span>
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
      {cheer && <div className="cheer">{cheer}</div>}
    </div>
  );
}
