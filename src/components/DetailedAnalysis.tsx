// 特典つきの応援で開く「くわしい分析」（仕様書 §4.11）。
// 問いごとの答えの分かれ方（3 人以上が答えた問いだけ）・意見のそろい方・自己回答とのちがい。だれが何と答えたかは出さない
import type { DetailedAnalysis as Analysis, QuestionStat } from "@/lib/premium";
import { AXES, POLE_LABEL } from "@/data/framework";

function Bar({ s }: { s: QuestionStat }) {
  const pct = (v: number) => `${(v / s.answered) * 100}%`;
  return (
    <div className="analysis-bar" aria-hidden="true">
      <span style={{ width: pct(s.agree), background: "var(--gc)" }} />
      <span style={{ width: pct(s.neutral), background: "var(--line)" }} />
      <span
        style={{ width: pct(s.disagree), background: "var(--muted, #999)" }}
      />
    </div>
  );
}

function Row({ s }: { s: QuestionStat }) {
  return (
    <li className="stack" style={{ gap: 4 }}>
      <span>『{s.summary}』</span>
      <Bar s={s} />
      <span className="muted small">
        {s.answered} 人のうち そう思う {s.agree} 人・どちらとも {s.neutral}{" "}
        人・ちがう {s.disagree} 人
        {s.self !== null ? `（自分の答え：${s.self}／7）` : ""}
      </span>
    </li>
  );
}

function axisLabel(axis: string): string {
  const def = AXES.find((a) => a.axis === axis)!;
  return `${POLE_LABEL[def.left].name} / ${POLE_LABEL[def.right].name}`;
}

export function DetailedAnalysis({ analysis }: { analysis: Analysis }) {
  const byNo = new Map(analysis.questions.map((q) => [q.no, q]));
  const pick = (nos: number[]) =>
    nos.map((n) => byNo.get(n)).filter((q): q is QuestionStat => Boolean(q));
  return (
    <section className="card stack">
      <h2 className="section-title">くわしい分析</h2>
      <p className="muted small">
        応援ありがとうございます。友達の答えを、問いごとにくわしく見られます。だれが何と答えたかは、ここでも分かりません（3
        人以上が答えた問いだけ出します）。
      </p>
      <h3 className="small">みんなの意見がそろった問い</h3>
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {pick(analysis.agreed).map((s) => (
          <Row key={s.no} s={s} />
        ))}
      </ul>
      {analysis.split.length > 0 && (
        <>
          <h3 className="small">意見が分かれた問い</h3>
          <p className="muted small">
            人によって見え方がちがうところ。相手や場面で、ちがう顔を見せているのかもしれません。
          </p>
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {pick(analysis.split).map((s) => (
              <Row key={s.no} s={s} />
            ))}
          </ul>
        </>
      )}
      {analysis.gaps.length > 0 && (
        <>
          <h3 className="small">
            自分の答えと、周りの見方が大きくちがった問い
          </h3>
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {pick(analysis.gaps).map((s) => (
              <Row key={s.no} s={s} />
            ))}
          </ul>
        </>
      )}
      <details>
        <summary>すべての問い（{analysis.questions.length} 問）</summary>
        {AXES.map((a) => {
          const list = analysis.questions.filter((q) => q.axis === a.axis);
          if (list.length === 0) return null;
          return (
            <div key={a.axis} className="stack" style={{ marginTop: 12 }}>
              <b className="small">{axisLabel(a.axis)}</b>
              <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
                {list.map((s) => (
                  <Row key={s.no} s={s} />
                ))}
              </ul>
            </div>
          );
        })}
      </details>
    </section>
  );
}
