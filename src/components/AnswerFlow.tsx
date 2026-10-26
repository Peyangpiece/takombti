"use client";
// 1 画面 1 問の回答（仕様書 §4.8・§4.9・§10）。回答者と自己回答で共用する。

import { useCallback, useEffect, useRef, useState } from "react";
import { QUESTIONS } from "../data/questions";
import { AXES } from "../data/framework";
import { incompleteAxes, UNKNOWN } from "../lib/scoring";
import { vibrate } from "../lib/client";

export type Draft = (number | null)[];

interface Props {
  name: string | null; // null なら自己回答
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
  6: "いいペース！",
  12: "あと半分！",
  18: "ラスト 6 問！",
};
const ADVANCE_MS = 250;

function dotColor(i: number): string {
  if (i < 3) return "var(--left)";
  if (i === 3) return "var(--line)";
  return "var(--brand)";
}

export function AnswerFlow({
  name,
  initial,
  initialIndex = 0,
  allowUnknown,
  onChange,
  onBack,
  onDone,
}: Props) {
  const [answers, setAnswers] = useState<Draft>(initial);
  const [index, setIndex] = useState(
    Math.min(initialIndex, QUESTIONS.length - 1),
  );
  const [pop, setPop] = useState<number | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const [needAxis, setNeedAxis] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);
  const q = QUESTIONS[index];

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const finish = useCallback(
    (list: Draft) => {
      const filled = list.map((a) => (a === null ? UNKNOWN : a));
      const firstEmpty = list.findIndex((a) => a === null);
      if (firstEmpty >= 0) {
        setIndex(firstEmpty);
        return;
      }
      const missing = incompleteAxes(filled);
      if (missing.length > 0) {
        // 判定できない軸があれば、その軸の「わからない」の問へ戻る（§3.4）
        const axis = missing[0];
        const target = QUESTIONS.find(
          (x) => x.axis === axis && filled[x.no - 1] === UNKNOWN,
        )!;
        setNeedAxis(axis);
        setIndex(target.no - 1);
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
      next[index] = value;
      setAnswers(next);
      setPop(value);
      vibrate();
      const answeredCount = next.filter((a) => a !== null).length;
      const wasNew = answers[index] === null;
      if (
        needAxis &&
        incompleteAxes(next.map((a) => (a === null ? UNKNOWN : a))).length === 0
      ) {
        setNeedAxis(null);
      }
      timer.current = setTimeout(() => {
        setPop(null);
        if (
          wasNew &&
          CHEERS[answeredCount] &&
          answeredCount < QUESTIONS.length
        ) {
          setCheer(CHEERS[answeredCount]);
          setTimeout(() => setCheer(null), 800);
        }
        const nextIndex = index + 1;
        if (nextIndex >= QUESTIONS.length || needAxis) {
          onChange(next, index);
          finish(next);
        } else {
          setIndex(nextIndex);
          onChange(next, nextIndex);
        }
      }, ADVANCE_MS);
    },
    [answers, index, needAxis, onChange, finish],
  );

  const prev = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (index === 0) onBack();
    else setIndex(index - 1);
  }, [index, onBack]);

  const forward = useCallback(() => {
    if (answers[index] === null) return;
    if (index + 1 >= QUESTIONS.length) finish(answers);
    else setIndex(index + 1);
  }, [answers, index, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // ラジオボタン本来の矢印キーの動きは止め、前後の問への移動に使う
      if (/^[1-7]$/.test(e.key)) choose(Number(e.key));
      else if (e.key === "0" && allowUnknown) choose(UNKNOWN);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") forward();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, prev, forward, allowUnknown]);

  // 回答者向けの文は「{name}は、…」の形なので、呼び名を色付きで先頭に出す
  const rest = name === null ? q.selfText : q.text.replace("{name}", "");
  const answeredCount = answers.filter((a) => a !== null).length;
  const current = answers[index];

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
            {index + 1} / {QUESTIONS.length}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={QUESTIONS.length}
            aria-valuenow={answeredCount}
            aria-label="答えた数"
          >
            <div
              style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
            />
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
          「{AXES.find((a) => a.axis === needAxis)!.name}」の質問は、あと 1
          つだけ答えてね。わからないものが多いと判定できないので、近いほうを選んでください
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
        <h1 key={index} className="q-text q-anim" id={`q-${q.no}`}>
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
                      width: sz,
                      height: sz,
                      ["--c" as string]: dotColor(i),
                    }}
                  />
                </label>
              );
            })}
          </fieldset>
          <div className="ends" aria-hidden="true">
            <span>ちがう</span>
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
