// タコ占いのカードの中身（/uranai の裏面と、応援のお願いの「2 枚目」で使う。仕様書 §4.11）
import { Octopus } from "./Octopus";
import type { Fortune } from "@/lib/fortune";

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`5 つ中 ${n}`} className="fortune-stars">
      {"★".repeat(n)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function FortuneBody({ fortune }: { fortune: Fortune }) {
  return (
    <>
      <div
        className="center"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Octopus code={fortune.type} size={96} />
        <span className="muted small">
          {fortune.date.replace(/-/g, "/")} の占い
        </span>
        <b className="text-group">
          {fortune.typeName}（{fortune.type}）のあなたへ
        </b>
      </div>
      <p>
        <b>{fortune.core}</b>
      </p>
      <p className="small">
        <span className="muted">あるある：</span>
        {fortune.aru}
      </p>
      <div className="fortune-today">
        <b>今日の運勢</b>
        <p>
          総合 <Stars n={fortune.today.overall} />
        </p>
        <p>
          恋愛 <Stars n={fortune.today.love} />
        </p>
        <p>
          友情 <Stars n={fortune.today.friends} />
        </p>
        <p>
          勉強・仕事 <Stars n={fortune.today.study} />
        </p>
        <p className="small">{fortune.message}</p>
      </div>
      <p>
        <span className="muted small">ラッキードリンク</span>
        <br />
        <b>{fortune.drink}</b>
      </p>
      <p>
        <span className="muted small">ラッキーカラー</span>
        <br />
        <b>{fortune.color}</b>
      </p>
      <p className="small">
        <span className="muted">アドバイス：</span>
        {fortune.advice}
      </p>
      <p className="muted small">
        今日の運勢・ラッキードリンク・ラッキーカラーは毎日かわります。また明日も見に来てね。この占いは遊びのもので、根拠のあるものではありません。
      </p>
    </>
  );
}
