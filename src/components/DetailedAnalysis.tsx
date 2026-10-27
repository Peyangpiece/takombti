// 特典つきの応援で開く「くわしい分析」（仕様書 §4.11）。
// タイプごとの読み物（章立て・目次つき）に、その人の結果から組み立てた読み解き（4 つの軸・友達の答え・ジョハリの窓）を足す。
// 最後に、問いごとの答えの分かれ方（3 人以上が答えた問いだけ）。だれが何と答えたかは出さない
import type { DetailedAnalysis as Analysis, QuestionStat } from "@/lib/premium";
import { AXES, POLE_LABEL, getType, type TypeCode } from "@/data/framework";
import { deepReading, meaningfulSplit } from "@/lib/deepAnalysis";
import { Octopus } from "./Octopus";
import type { AxisResult } from "@/lib/scoring";

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

function Legend() {
  const dot = (color: string) => (
    <span className="legend-dot" style={{ background: color }} />
  );
  return (
    <p className="muted small legend">
      {dot("var(--gc)")}そう思う（5〜7）{dot("var(--line)")}どちらとも（4）
      {dot("var(--muted, #999)")}ちがう（1〜3）
    </p>
  );
}

function axisLabel(axis: string): string {
  const def = AXES.find((a) => a.axis === axis)!;
  return `${POLE_LABEL[def.left].name} / ${POLE_LABEL[def.right].name}`;
}

const quote = (list: string[]) => list.map((s) => `『${s}』`).join("と");

export function DetailedAnalysis({
  code,
  n,
  axes,
  analysis,
}: {
  code: TypeCode;
  n: number;
  axes: AxisResult[];
  analysis: Analysis;
}) {
  const byNo = new Map(analysis.questions.map((q) => [q.no, q]));
  const pick = (nos: number[]) =>
    nos.map((no) => byNo.get(no)).filter((q): q is QuestionStat => Boolean(q));
  const reading = deepReading(code, axes, analysis);
  const [intro, ...rest] = reading.chapters;
  const split = meaningfulSplit(analysis);
  const toc = [
    intro,
    { id: "yours", title: "あなたの結果から読み解く" },
    ...rest,
    { id: "data", title: "答えのくわしいデータ" },
  ];
  const type = getType(code);

  return (
    <section className="card stack deep-analysis">
      <h2 className="section-title">くわしい分析</h2>
      <div className="deep-lead">
        <Octopus code={code} size={64} />
        <p className="small">
          友達 {n} 人の答えをもとに、{type.name}（{code}
          ）として周りから見えているあなたを、もう一段深く読み解きました。
        </p>
      </div>
      <nav aria-label="くわしい分析の目次" className="deep-toc">
        <b className="small">目次</b>
        <ol className="small">
          {toc.map((c) => (
            <li key={c.id}>
              <a href={`#deep-${c.id}`}>{c.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <Chapter no={1} id={intro.id} title={intro.title}>
        <Paras text={intro.text ?? ""} />
      </Chapter>

      <Chapter no={2} id="yours" title="あなたの結果から読み解く">
        <h4>4 つの軸の出方</h4>
        <ul className="deep-list tinted">
          {reading.axes.map((a) => (
            <li key={a.label}>
              <b>{a.label}</b>
              <p>{a.text}</p>
            </li>
          ))}
        </ul>
        {reading.view.length > 0 && (
          <>
            <h4>友達の答えから</h4>
            <div className="deep-quote">
              {reading.view.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </>
        )}
        <h4>ジョハリの窓で見ると</h4>
        <p className="small">
          心理学の「ジョハリの窓」は、自分のことを「自分が知っているか」「周りが知っているか」で
          4 つの窓に分けて考える方法です。
        </p>
        {reading.johari ? (
          <>
            <p className="small">
              自分の答えと友達の答えを比べると、次のようになりました。
            </p>
            <ul className="deep-list johari">
              <li className="open">
                <b>開放の窓</b>
                <span className="deep-sub">
                  自分も周りも「そう」と思っている
                </span>
                <p>
                  {reading.johari.open.length > 0
                    ? `${quote(reading.johari.open)}。あなたらしさとして、自分でも周りでもはっきり重なっているところです。`
                    : "今回は、はっきり重なった問いはありませんでした。"}
                </p>
              </li>
              <li className="blind">
                <b>盲点の窓</b>
                <span className="deep-sub">
                  周りは「そう」と思っているのに、自分では気づいていない
                </span>
                <p>
                  {reading.johari.blind.length > 0
                    ? `${quote(reading.johari.blind)}。自分で思っているより、周りにはそう見えているようです。思いがけない長所かもしれません。`
                    : "今回は、大きなずれはありませんでした。自分の見え方を、よくつかめているようです。"}
                </p>
              </li>
              <li className="secret">
                <b>秘密の窓</b>
                <span className="deep-sub">
                  自分では「そう」と思っているのに、周りにはまだ伝わっていない
                </span>
                <p>
                  {reading.johari.hidden.length > 0
                    ? `${quote(reading.johari.hidden)}。言葉や行動で少し見せると、周りの見え方も変わっていくかもしれません。`
                    : "今回は、大きなずれはありませんでした。"}
                </p>
              </li>
            </ul>
          </>
        ) : (
          <p className="muted small">
            この診断には自己回答がないため、ジョハリの窓では読み解けませんでした。自己回答は受付中にだけできます（人数をふやして受付を再開したときにも答えられます）。
          </p>
        )}
      </Chapter>

      {rest.map((c, i) => (
        <Chapter key={c.id} no={i + 3} id={c.id} title={c.title}>
          {c.items ? (
            <ul
              className={`deep-list ${c.id === "weaknesses" ? "care" : "good"}`}
            >
              {c.items.map((it) => (
                <li key={it.title}>
                  <b>{it.title}</b>
                  <p>{it.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Paras text={c.text ?? ""} />
          )}
        </Chapter>
      ))}

      <details id="deep-data">
        <summary>答えのくわしいデータ</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="muted small">
            だれが何と答えたかは、ここでも分かりません（3
            人以上が答えた問いだけ出します）。
          </p>
          <Legend />
          <h3 className="small">みんなの意見がそろった問い</h3>
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {pick(analysis.agreed).map((s) => (
              <Row key={s.no} s={s} />
            ))}
          </ul>
          {split.length > 0 && (
            <>
              <h3 className="small">意見が分かれた問い</h3>
              <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
                {pick(split).map((s) => (
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
          <h3 className="small">
            すべての問い（{analysis.questions.length} 問）
          </h3>
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
        </div>
      </details>
      <p className="muted small">
        この読み物は、友達の答えから見えた傾向をもとにした娯楽のためのもので、あなたの能力や価値を決めるものではありません。
      </p>
    </section>
  );
}

// 改行（\n）で段落に分ける。改行のない長い文は、読みやすいよう、文の切れ目でおよそ 120 字ごとに分ける
function paragraphs(text: string): string[] {
  const parts = text.split("\n").filter((t) => t.trim());
  if (parts.length > 1) return parts;
  const sentences = text.match(/[^。]+。?/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const sen of sentences) {
    cur += sen;
    if (cur.length >= 120) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) {
    // 短すぎる最後の段落は、前の段落につなげる
    if (out.length > 0 && cur.length < 40) out[out.length - 1] += cur;
    else out.push(cur);
  }
  return out;
}

function Paras({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((t, i) => (
        <p key={i}>{t}</p>
      ))}
    </>
  );
}

function Chapter({
  no,
  id,
  title,
  children,
}: {
  no: number;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`deep-${id}`} className="deep-chapter stack">
      <h3 className="deep-title">
        <span className="deep-no">{String(no).padStart(2, "0")}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
