// 結果の見本（仕様書 §4.2・§4.10）。架空の結果で、だれの答えでもない。
// トップの「結果の見本」と、回答完了の画面（R3）の小さな見本で同じ値を使う
import { GROUPS, getType, groupOf, type TypeCode } from "../data/framework";
import { strengthOf, type AxisResult, type Spread } from "../lib/scoring";
import { Meters } from "./Meters";
import { Octopus } from "./Octopus";

export const SAMPLE_CODE: TypeCode = "ENFP";
export const SAMPLE_N = 5;

function axis(
  a: AxisResult["axis"],
  pole: AxisResult["pole"],
  percent: number,
  agreement: AxisResult["agreement"] = "ほぼ一致",
): AxisResult {
  return {
    axis: a,
    pole,
    percent,
    strength: strengthOf(percent),
    agreement,
    tie: false,
  };
}

export const SAMPLE_AXES = [
  axis("A1", "E", 72),
  axis("A2", "N", 64),
  axis("A3", "F", 81),
  axis("A4", "P", 58, "多数派"),
];

// 帯の下の言葉（§7.3）。結果の画面と同じ決まりで当たりうる組み合わせにする
export const SAMPLE_SPREADS: (Spread | null)[] = [
  "aligned",
  null,
  "aligned",
  "divided",
];

// 見本の頭（タコ・「見本：たろうは友達 5 人から見ると」・4 文字・タイプ名）
export function SampleHead({ size = 72 }: { size?: number }) {
  return (
    <div className="sample-head">
      <Octopus code={SAMPLE_CODE} size={size} />
      <div>
        <p className="muted small">
          見本：たろうは友達 {SAMPLE_N} 人から見ると
        </p>
        <p className="sample-code">{SAMPLE_CODE}</p>
        <p className="sample-name">{getType(SAMPLE_CODE).name}</p>
      </div>
    </div>
  );
}

// 回答完了の画面（R3）の小さな見本：タイプと 4 つの軸だけ
export function SamplePreview() {
  const group = GROUPS[groupOf(SAMPLE_CODE)];
  return (
    <div
      className="sample-result sample-mini stack"
      style={{ ["--gc" as string]: group.ink }}
      aria-label="結果の見本"
    >
      <SampleHead size={56} />
      <Meters axes={SAMPLE_AXES} spreads={SAMPLE_SPREADS} />
    </div>
  );
}
