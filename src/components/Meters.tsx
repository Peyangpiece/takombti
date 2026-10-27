// 4 軸メーター（仕様書 §7.3・§7.6）
import { AXES, POLE_LABEL } from "../data/framework";
import type { AxisResult, SelfAxis } from "../lib/scoring";

function leftPercentOf(pole: string, left: string, percent: number): number {
  return pole === left ? percent : 100 - percent;
}

// self があれば、軸ごとに周り（上）と自分（下）の 2 本を並べる（周りと自分の比較）
export function Meters({
  axes,
  self,
}: {
  axes: AxisResult[];
  self?: SelfAxis[];
}) {
  return (
    <div>
      {axes.map((a, i) => {
        const def = AXES.find((x) => x.axis === a.axis)!;
        const leftWins = a.pole === def.left;
        const lp = leftPercentOf(a.pole, def.left, a.percent);
        const s = self?.[i];
        const slp = s ? leftPercentOf(s.pole, def.left, s.percent) : null;
        return (
          <div className="meter" key={a.axis}>
            <div className="ends">
              <span className={leftWins ? "win" : "muted"}>
                {POLE_LABEL[def.left].name}
                {leftWins && ` ${a.percent}%`}
              </span>
              <span className={!leftWins ? "win" : "muted"}>
                {!leftWins && `${a.percent}% `}
                {POLE_LABEL[def.right].name}
              </span>
            </div>
            <div
              className="bar"
              role="img"
              aria-label={`${self ? "周りから見ると " : ""}${a.tie ? "どちらとも言えない（50%）" : `${POLE_LABEL[a.pole].name} ${a.percent}%`}`}
            >
              <div
                className="fill"
                style={
                  leftWins
                    ? { left: 0, width: `${a.percent}%` }
                    : { left: `${lp}%`, right: 0 }
                }
              />
              <div className="knob" style={{ left: `${lp}%` }} />
            </div>
            {s && slp !== null && (
              <div
                className="bar self"
                role="img"
                aria-label={`自分では ${s.tie ? "どちらとも言えない（50%）" : `${POLE_LABEL[s.pole].name} ${s.percent}%`}`}
              >
                {/* 自分がど真ん中なら、どちらかの側に色を付けない（片方に寄って見えないように） */}
                {!s.tie && (
                  <div
                    className="fill"
                    style={
                      s.pole === def.left
                        ? { left: 0, width: `${s.percent}%` }
                        : { left: `${slp}%`, right: 0 }
                    }
                  />
                )}
                <div
                  className="knob"
                  style={{ left: `${slp}%`, opacity: 0.6 }}
                />
              </div>
            )}
          </div>
        );
      })}
      {self && (
        <p className="meter-legend">
          <span className="legend-bar" aria-hidden="true" />
          周りから見たあなた
          <span className="legend-bar self" aria-hidden="true" />
          自分で思うあなた
        </p>
      )}
    </div>
  );
}
