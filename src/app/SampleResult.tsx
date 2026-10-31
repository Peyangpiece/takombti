// トップの「結果の見本」（仕様書 §4.2）。友達に頼む前に、どんな結果が出るかを見られるようにする。
// 架空の結果だと分かるように「見本」と書き、文は結果の画面と同じ組み立て方で作る
import { Meters } from "@/components/Meters";
import { Rich } from "@/components/Rich";
import {
  SAMPLE_AXES,
  SAMPLE_CODE,
  SAMPLE_N,
  SAMPLE_SPREADS,
  SampleHead,
} from "@/components/SamplePreview";
import { GROUPS, groupOf } from "@/data/framework";
import { describeInsight } from "@/lib/describe";
import type { Insight } from "@/lib/scoring";

const INSIGHTS: Insight[] = [
  { rule: "D1", params: { pole: "F", p: 81, N: SAMPLE_N } },
  { rule: "D5", params: { no: 1, answered: SAMPLE_N, count: SAMPLE_N } },
];

export function SampleResult() {
  const group = GROUPS[groupOf(SAMPLE_CODE)];
  return (
    // id：16 タイプの紹介（§4.14）から「結果の見本を見る」で飛んでくる先
    <section
      id="sample"
      className="card stack sample-result"
      aria-label="結果の見本"
      style={{ ["--gc" as string]: group.ink }}
    >
      <h2 className="section-title">結果の見本</h2>
      <SampleHead />
      <Meters axes={SAMPLE_AXES} spreads={SAMPLE_SPREADS} />
      <ul className="list-plain">
        {INSIGHTS.map((ins) => (
          <li key={ins.rule} className="insight">
            <span>
              <Rich text={describeInsight(ins, undefined, SAMPLE_AXES).text} />
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        結果の画面では、このほかにタイプの見られ方・強み・言われがちな一言・自分の見方とのちがいなども出ます。
      </p>
    </section>
  );
}
