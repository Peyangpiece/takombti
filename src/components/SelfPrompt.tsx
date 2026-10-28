// 自己回答へのお誘い（仕様書 §4.4）。共有の画面と回答状況の画面の、上のほうに置く
import { ANSWER_TIME_LABEL } from "@/data/questions";

export function SelfPrompt({ hostKey }: { hostKey: string }) {
  return (
    <div className="card stack self-prompt">
      <b>待っている間に、自分でも答えておく？</b>
      <p className="small">
        周りから見た自分とのギャップがわかります。友達には見えません。
      </p>
      <a href={`/h/self#${hostKey}`} className="btn secondary">
        自己回答をする（{ANSWER_TIME_LABEL}）
      </a>
    </div>
  );
}
