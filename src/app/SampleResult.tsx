// トップの「結果の見本」（仕様書 §4.2）。友達に頼む前に、どんな結果が出るかを見られるようにする。
// 架空の結果だと分かるように「見本」と書き、文は結果の画面と同じ組み立て方で作る
import { Meters } from "@/components/Meters";
import { Octopus } from "@/components/Octopus";
import { Rich } from "@/components/Rich";
import { GROUPS, getType, groupOf, type TypeCode } from "@/data/framework";
import { describeInsight } from "@/lib/describe";
import { strengthOf, type AxisResult, type Insight } from "@/lib/scoring";

const CODE: TypeCode = "ENFP";
const N = 5;

function axis(
  a: AxisResult["axis"],
  pole: AxisResult["pole"],
  percent: number,
): AxisResult {
  return {
    axis: a,
    pole,
    percent,
    strength: strengthOf(percent),
    agreement: "ほぼ一致",
    tie: false,
    sum: 0,
  };
}

const AXES_SAMPLE = [
  axis("A1", "E", 72),
  axis("A2", "N", 64),
  axis("A3", "F", 81),
  axis("A4", "P", 58),
];

const INSIGHTS: Insight[] = [
  { rule: "D1", params: { pole: "F", p: 81, N } },
  { rule: "D5", params: { no: 1, answered: N, count: N } },
];

export function SampleResult() {
  const type = getType(CODE);
  const group = GROUPS[groupOf(CODE)];
  return (
    <section
      className="card stack sample-result"
      aria-label="結果の見本"
      style={{ ["--gc" as string]: group.ink }}
    >
      <h2 className="section-title">結果の見本</h2>
      <div className="sample-head">
        <Octopus code={CODE} size={72} />
        <div>
          <p className="muted small">見本：たろうは友達 {N} 人から見ると</p>
          <p className="sample-code">{CODE}</p>
          <p className="sample-name">{type.name}</p>
        </div>
      </div>
      <Meters axes={AXES_SAMPLE} />
      <ul className="list-plain">
        {INSIGHTS.map((ins) => (
          <li key={ins.rule} className="insight">
            <span>
              <Rich text={describeInsight(ins, undefined, AXES_SAMPLE).text} />
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        結果の画面では、このほかに友達から見たあなた・強み・あるある・自分の見方とのちがいなども出ます。
      </p>
    </section>
  );
}
