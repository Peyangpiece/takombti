// タイプのカード（仕様書 §7.2）
import { GROUPS, getType, groupOf, type TypeCode } from "../data/framework";
import { Octopus } from "./Octopus";

interface Props {
  code: TypeCode;
  ties?: boolean[];
  lead?: string;
}

export function TypeCard({
  code,
  ties = [false, false, false, false],
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
        <Octopus code={code} color="#ffffff" size={120} />
      </div>
      <div
        className="code"
        aria-label={`タイプの記号 ${code.split("").join(" ")}`}
      >
        {code.split("").map((c, i) => (
          <span key={i} className={ties[i] ? "half" : undefined}>
            {c}
          </span>
        ))}
      </div>
      {ties.some(Boolean) && (
        <div className="both">うすい文字はどっちも（ど真ん中）</div>
      )}
      <div className="tname">{type.name}</div>
      <p className="catch">{type.catch}</p>
      <div className="tags">
        {type.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
      </div>
    </section>
  );
}
