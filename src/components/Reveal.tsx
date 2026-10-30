"use client";
// 結果発表の演出（仕様書 §4.11）。2〜3 秒、飛ばせる。動きを減らす設定なら出さない。
import { useEffect, useState } from "react";
import { GROUPS, getType, groupOf, type TypeCode } from "../data/framework";
import { prefersReducedMotion } from "../lib/client";

const LETTERS = ["EI", "SN", "TF", "JP"];

export function Reveal({
  code,
  n,
  onEnd,
}: {
  code: TypeCode;
  n: number;
  onEnd: () => void;
}) {
  const [phase, setPhase] = useState(0); // 0 集計中, 1〜4 文字が止まる, 5 タイプ名
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      onEnd();
      return;
    }
    const times = [700, 1050, 1400, 1750, 2100, 3000];
    const ids = times.map((t, i) =>
      setTimeout(() => (i < 5 ? setPhase(i + 1) : onEnd()), t),
    );
    const spin = setInterval(() => setTick((x) => x + 1), 90);
    return () => {
      ids.forEach(clearTimeout);
      clearInterval(spin);
    };
  }, [onEnd]);

  const group = GROUPS[groupOf(code)];
  return (
    <div
      className="reveal"
      style={{ ["--gc" as string]: group.color }}
      role="dialog"
      aria-label="結果発表"
    >
      <button type="button" className="skip" onClick={onEnd} autoFocus>
        とばす
      </button>
      {phase >= 5 && <div className="burst" />}
      <p style={{ position: "relative" }}>
        {phase === 0 ? `${n} 人の答えを集計中…` : "あなたは周りから見ると…"}
      </p>
      <div className="slots" style={{ position: "relative" }}>
        {LETTERS.map((pair, i) => {
          const stopped = phase > i;
          return (
            <div key={pair} className={`slot${stopped ? "" : " spin"}`}>
              {stopped ? code[i] : pair[(tick + i) % 2]}
            </div>
          );
        })}
      </div>
      <p
        style={{
          position: "relative",
          fontSize: 30,
          fontWeight: 900,
          minHeight: 48,
        }}
      >
        {phase >= 5 ? getType(code).name : ""}
      </p>
    </div>
  );
}
