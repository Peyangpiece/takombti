// 4 軸メーター（仕様書 §7.3・§7.6）
// 帯は中央が「ちょうど半々」。寄っている極の側へ、寄り具合のぶんだけ中央から塗り、つまみをその先に置く
// （端から塗ると、つまみが反対の極の側に来て読みまちがえやすいため）
import { AXES, POLE_LABEL } from "../data/framework";
import { leanFill, leanPosition } from "../lib/compare";
import {
  WEAK_PERCENT,
  type AxisResult,
  type SelfAxis,
  type Spread,
} from "../lib/scoring";

// 帯の下に添える、友達の見え方の散らばり（§7.3）。言い切れない軸には何も添えない
export const SPREAD_LABEL: Record<Spread, string> = {
  aligned: "友達の見え方がそろっている",
  divided: "人によって見え方がちがう",
  middle: "多くの友達が真ん中寄り",
};

// メーターに使う値だけ（公開カードの軸の値もそのまま渡せる）
type Point = Pick<AxisResult, "axis" | "pole" | "percent" | "tie">;

// 読み上げで使う「外向 72%」「どちらとも言えない（50%）」
function valueLabel(a: Point) {
  return a.tie
    ? "どちらとも言えない（50%）"
    : `${POLE_LABEL[a.pole].name} ${a.percent}%`;
}

function Bar({
  point,
  label,
  self = false,
}: {
  point: Point;
  label: string;
  self?: boolean;
}) {
  const pos = leanPosition(point);
  const fill = leanFill(point);
  return (
    <div className={`bar${self ? " self" : ""}`} role="img" aria-label={label}>
      {/* ど真ん中なら、どちらの側にも色を付けない（片方に寄って見えないように） */}
      {!point.tie && (
        <div
          className="fill"
          style={{ left: `${fill.left}%`, width: `${fill.width}%` }}
        />
      )}
      <div className="knob" style={{ left: `${pos}%` }} />
    </div>
  );
}

// self があれば、軸ごとに周り（上）と自分（下）の 2 本を並べる（周りと自分の比較）
export function Meters({
  axes,
  self,
  spreads,
}: {
  axes: Point[];
  self?: SelfAxis[];
  spreads?: (Spread | null)[] | null;
}) {
  return (
    <div>
      {/* 2 本の帯の見分け方は、帯より先に読めるよう上に置く */}
      {self && (
        <p className="meter-legend top">
          <span className="legend-bar" aria-hidden="true" />
          周りから見たあなた
          <span className="legend-bar self" aria-hidden="true" />
          自分で思うあなた
        </p>
      )}
      {axes.map((a, i) => {
        const def = AXES.find((x) => x.axis === a.axis)!;
        const leftWins = !a.tie && a.pole === def.left;
        const rightWins = !a.tie && a.pole === def.right;
        const weak = !a.tie && a.percent < WEAK_PERCENT;
        const s = self?.[i];
        const spread = spreads?.[i] ?? null;
        return (
          <div className="meter" key={a.axis}>
            <div className="ends">
              <span className={leftWins ? "win" : "muted"}>
                {POLE_LABEL[def.left].name}
                {leftWins && ` ${a.percent}%`}
              </span>
              {/* ど真ん中・ほぼ半々（§7.2 の点線の文字）は、真ん中にことばで添える */}
              {(a.tie || weak) && (
                <span className="mid">
                  {a.tie ? "どちらとも（50%）" : "ほぼ半々"}
                </span>
              )}
              <span className={rightWins ? "win" : "muted"}>
                {rightWins && `${a.percent}% `}
                {POLE_LABEL[def.right].name}
              </span>
            </div>
            <Bar
              point={a}
              label={`${self ? "周りから見ると " : ""}${valueLabel(a)}`}
            />
            {s && <Bar point={s} label={`自分では ${valueLabel(s)}`} self />}
            {spread && (
              <p className={`meter-spread ${spread}`}>{SPREAD_LABEL[spread]}</p>
            )}
          </div>
        );
      })}
      {/* ％の意味。人数の割合とまちがえやすいので書いておく */}
      <p className="meter-note">
        ％は人数の割合ではなく、友達の答えの寄り具合です（50%
        がちょうど半々、全員が最も強く答えると
        100%）。帯は真ん中から、寄っている側へのびます。
      </p>
    </div>
  );
}
