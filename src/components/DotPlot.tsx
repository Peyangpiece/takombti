// 友達 1 人ずつの見え方の図（くわしい分析。仕様書 §4.11）。点 1 つが友達 1 人。
// 位置は段階にまとめ、軸どうしで同じ人の点をつながない（だれの点か見当がつかないように）。
// 関係ごとの色分けはしない（§8.5）
import { AXES, POLE_LABEL } from "../data/framework";
import { DOT_BINS, type DetailedAnalysis } from "../lib/premium";
import type { AxisResult, Spread } from "../lib/scoring";
import { SPREAD_LABEL } from "./Meters";

const W = 340;
const R = 7;
const STEP = 2 * R + 2;
// 積み上げる点の高さの上限（これより多い段階は、点を少し重ねて収める）
const MAX_STACK = 8;

export function DotPlot({
  dots,
  axes,
  spreads,
  n,
}: {
  dots: NonNullable<DetailedAnalysis["dots"]>;
  axes: AxisResult[];
  spreads: (Spread | null)[] | null;
  n: number;
}) {
  const most = Math.max(1, ...dots.flatMap((d) => d.bins));
  const step = most > MAX_STACK ? (STEP * MAX_STACK) / most : STEP;
  const base = Math.min(most, MAX_STACK) * STEP + 4;
  // 線の下に、平均（▲）と中央値（◆）を 1 段ずつ
  const height = base + 34;
  const cw = W / DOT_BINS;
  const mid = (DOT_BINS - 1) / 2;
  return (
    <div className="dotplot">
      <p className="small">
        点 1 つが友達 1 人です（{n}{" "}
        人）。線の左はしに近いほど左の性質、右はしに近いほど右の性質に見えています。位置は{" "}
        {DOT_BINS}{" "}
        段階にまとめています。どの点がだれかは分からず、軸どうしで同じ人の点をつなぐこともできません。
      </p>
      {dots.map((d, i) => {
        const def = AXES.find((a) => a.axis === d.axis)!;
        const a = axes.find((x) => x.axis === d.axis)!;
        const leftWins = a.pole === def.left;
        const leftPercent = leftWins ? a.percent : 100 - a.percent;
        const mx = W * (1 - leftPercent / 100);
        const medianX = cw * d.median + cw / 2;
        const spread = spreads?.[i] ?? null;
        const counts = d.bins.join("・");
        return (
          <div className="dotplot-row" key={d.axis}>
            <div className="ends">
              <span className={leftWins ? "win" : "muted"}>
                {POLE_LABEL[def.left].name}
                {leftWins && !a.tie && ` ${a.percent}%`}
              </span>
              <span className={!leftWins ? "win" : "muted"}>
                {!leftWins && !a.tie && `${a.percent}% `}
                {POLE_LABEL[def.right].name}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${height}`}
              role="img"
              aria-label={`${POLE_LABEL[def.left].name}から${POLE_LABEL[def.right].name}まで ${DOT_BINS} 段階の人数：${counts}`}
            >
              <line
                x1={0}
                y1={base}
                x2={W}
                y2={base}
                className="dotplot-axis"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <line
                x1={W / 2}
                y1={base - 6}
                x2={W / 2}
                y2={base + 6}
                className="dotplot-axis"
                strokeWidth={2}
              />
              {d.bins.flatMap((c, b) => {
                // 真ん中の段階は、少しでも結果の側に寄っていた人を下から塗る。ちょうど 0 点の人は結果の側ではないので白抜き
                const won =
                  b === mid
                    ? leftWins
                      ? d.mid.left
                      : d.mid.right
                    : b < mid === leftWins
                      ? c
                      : 0;
                return Array.from({ length: c }, (_, k) => {
                  const side = k < won ? "win" : "other";
                  return (
                    <circle
                      key={`${b}-${k}`}
                      cx={cw * b + cw / 2}
                      cy={base - R - 2 - k * step}
                      r={side === "other" ? R - 1.25 : R}
                      className={`dot ${side}`}
                    />
                  );
                });
              })}
              <path
                d={`M${mx} ${base + 3} L${mx + 7} ${base + 15} L${mx - 7} ${base + 15} Z`}
                className="dotplot-mean"
              />
              <path
                d={`M${medianX} ${base + 19} L${medianX + 7} ${base + 26} L${medianX} ${base + 33} L${medianX - 7} ${base + 26} Z`}
                className="dotplot-mean"
              />
            </svg>
            {spread && <p className="meter-spread">{SPREAD_LABEL[spread]}</p>}
          </div>
        );
      })}
      <p className="dotplot-legend" aria-hidden="true">
        <span>
          <i className="dot-key win" />
          結果の側
        </span>
        <span>
          <i className="dot-key other" />
          反対の側・ちょうど半々
        </span>
        <span>
          <i className="mean-key" />
          みんなの平均
        </span>
        <span>
          <i className="median-key" />
          中央値（順に並べて真ん中の人）
        </span>
      </p>
    </div>
  );
}
