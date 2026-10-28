// タイプのカード（仕様書 §7.2）
import { GROUPS, getType, groupOf, type TypeCode } from "../data/framework";
import { Octopus } from "./Octopus";

interface Props {
  code: TypeCode;
  ties?: boolean[];
  // ほぼ半々（55% 未満）で、別の友達に聞くと入れ替わりやすい軸（§7.2）
  weak?: boolean[];
  // ゆるめの判定（§7.2）。どの軸も強く出ていないことを、正直に小さく添える
  loose?: boolean;
  lead?: string;
}

export function TypeCard({
  code,
  ties = [false, false, false, false],
  weak = [false, false, false, false],
  loose = false,
  lead,
}: Props) {
  const type = getType(code);
  const group = GROUPS[groupOf(code)];
  return (
    <section
      className="type-card"
      style={{ ["--gc" as string]: group.ink }}
      aria-label="あなたのタイプ"
    >
      {lead && (
        <p style={{ fontWeight: 700, opacity: 0.9, marginBottom: 4 }}>{lead}</p>
      )}
      <span className="group">{group.name}</span>
      <div style={{ marginTop: 8 }}>
        <Octopus code={code} size={132} />
      </div>
      <div
        className="code"
        aria-label={`タイプの記号 ${code
          .split("")
          .map((c, i) =>
            ties[i] ? `${c}（ど真ん中）` : weak[i] ? `${c}（ほぼ半々）` : c,
          )
          .join(" ")}`}
      >
        {code.split("").map((c, i) => (
          <span
            key={i}
            className={ties[i] ? "half" : weak[i] ? "weak" : undefined}
          >
            {c}
          </span>
        ))}
      </div>
      {ties.some(Boolean) && (
        <div className="both">半分うすい文字はどっちも（ど真ん中）</div>
      )}
      {weak.some(Boolean) && (
        <div className="both">
          点線の文字はほぼ半々。別の友達に聞くと入れかわるかも
        </div>
      )}
      <div className="tname">{type.name}</div>
      <p className="catch">{type.catch}</p>
      {loose && (
        <p className="loose">
          <b>ゆるめの判定</b>
          ：どの軸も強くは出ていないので、ほかのタイプにも少しずつ当てはまります
        </p>
      )}
      <div className="tags">
        {type.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
      </div>
    </section>
  );
}
