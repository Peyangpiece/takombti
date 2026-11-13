// 4 軸メーター（仕様書 §7.3・§7.6）
// 帯は、選ばれた極の側の端から割合のぶんだけ塗り（外向 72% なら左端から 72%）、つまみをその先に置く。
// 真ん中の目印（ちょうど半々）をこえて塗られているので、どちらに寄っているかが分かる。
// mascot を渡すと、つまみをそのタイプのタコにする（周りから見た帯だけ。自分の帯は丸いつまみのまま）
import { AXES, POLE_LABEL } from "../data/framework";
import { leanFill, leanPosition } from "../lib/compare";
import {
  WEAK_PERCENT,
  type AxisResult,
  type SelfAxis,
  type Spread,
} from "../lib/scoring";
import { Octopus } from "./Octopus";

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
  mascot,
}: {
  point: Point;
  label: string;
  self?: boolean;
  mascot?: string;
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
      {mascot && !self ? (
        <div className="knob tako" style={{ left: `${pos}%` }}>
          <Octopus code={mascot} size={36} />
        </div>
      ) : (
        <div className="knob" style={{ left: `${pos}%` }} />
      )}
    </div>
  );
}

// 寄っている側の割合。数字を大きく、％ は小さく出す
function Percent({ value }: { value: number }) {
  return (
    <span className="pct">
      {value}
      <small>%</small>
    </span>
  );
}

// self があれば、軸ごとに周り（上）と自分（下）の 2 本を並べる（周りと自分の比較）
export function Meters({
  axes,
  self,
  spreads,
  mascot,
}: {
  axes: Point[];
  self?: SelfAxis[];
  spreads?: (Spread | null)[] | null;
  mascot?: string;
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
          <div className={`meter${mascot ? " has-tako" : ""}`} key={a.axis}>
            <div className="ends">
              <span className={leftWins ? "win" : "muted"}>
                {POLE_LABEL[def.left].name}
                {leftWins && <Percent value={a.percent} />}
              </span>
              {/* ど真ん中・ほぼ半々（§7.2 の点線の文字）は、真ん中にことばで添える */}
              {(a.tie || weak) && (
                <span className="mid">
                  {a.tie ? "どちらとも（50%）" : "ほぼ半々"}
                </span>
              )}
              <span className={rightWins ? "win" : "muted"}>
                {rightWins && <Percent value={a.percent} />}
                {POLE_LABEL[def.right].name}
              </span>
            </div>
            <Bar
              point={a}
              label={`${self ? "周りから見ると " : ""}${valueLabel(a)}`}
              mascot={mascot}
            />
            {s && <Bar point={s} label={`自分では ${valueLabel(s)}`} self />}
            {spread && (
              <p className={`meter-spread ${spread}`}>{SPREAD_LABEL[spread]}</p>
            )}
          </div>
        );
      })}
      {/* ％の意味。人数の割合とまちがえやすいので書いておく（たたんでおき、気になった人が開く） */}
      <details className="fine-print meter-help">
        <summary>％の見方</summary>
        <p>
          ％は人数の割合ではなく、答えの寄り具合です。50%
          がちょうど半々で、全員が最も強く答えると 100% になります。
        </p>
      </details>
    </div>
  );
}
