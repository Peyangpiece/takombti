// 4 軸メーター（仕様書 §7.3・§7.6）
import { AXES, POLE_LABEL } from "../data/framework";
import type { AxisResult, SelfAxis } from "../lib/scoring";

function leftPercentOf(pole: string, left: string, percent: number): number {
  return pole === left ? percent : 100 - percent;
}

// self：周りと自分を 2 本に分けて並べる（自分 vs 周り）
// ghost：周りのメーターに、自分の位置を薄い丸で重ねる（4 つの軸）
export function Meters({
  axes,
  self,
  ghost,
}: {
  axes: AxisResult[];
  self?: SelfAxis[];
  ghost?: SelfAxis[];
}) {
  return (
    <div>
      {axes.map((a, i) => {
        const def = AXES.find((x) => x.axis === a.axis)!;
        const leftWins = a.pole === def.left;
        const lp = leftPercentOf(a.pole, def.left, a.percent);
        const s = self?.[i];
        const slp = s ? leftPercentOf(s.pole, def.left, s.percent) : null;
        const g = ghost?.[i];
        const glp = g ? leftPercentOf(g.pole, def.left, g.percent) : null;
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
              aria-label={`${self || g ? "周りから見ると " : ""}${POLE_LABEL[a.pole].name} ${a.percent}%${g ? `（自分では ${POLE_LABEL[g.pole].name} ${g.percent}%）` : ""}`}
            >
              <div
                className="fill"
                style={
                  leftWins
                    ? { left: 0, width: `${a.percent}%` }
                    : { left: `${lp}%`, right: 0 }
                }
              />
              {glp !== null && (
                <div className="ghost" style={{ left: `${glp}%` }} />
              )}
              <div className="knob" style={{ left: `${lp}%` }} />
            </div>
            {s && slp !== null && (
              <div
                className="bar self"
                role="img"
                aria-label={`自分では ${POLE_LABEL[s.pole].name} ${s.percent}%`}
              >
                <div
                  className="fill"
                  style={
                    s.pole === def.left
                      ? { left: 0, width: `${s.percent}%` }
                      : { left: `${slp}%`, right: 0 }
                  }
                />
                <div
                  className="knob"
                  style={{ left: `${slp}%`, opacity: 0.6 }}
                />
              </div>
            )}
            {self && (
              <div className="note">
                上：周りから見たあなた ／ 下：自分で思うあなた（
                {s!.tie
                  ? "ど真ん中"
                  : `${POLE_LABEL[s!.pole].name} ${s!.percent}%`}
                ）
              </div>
            )}
          </div>
        );
      })}
      {ghost && (
        <p className="meter-legend">
          <span className="legend-knob" aria-hidden="true" />
          周りから見たあなた
          <span className="legend-ghost" aria-hidden="true" />
          自分で思うあなた
        </p>
      )}
    </div>
  );
}
