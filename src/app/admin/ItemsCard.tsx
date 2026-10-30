"use client";
// 問ごとの質（仕様書 §11.12）。運営者のページに出す
import { useState } from "react";
import type { ItemSummary } from "@/lib/itemStats";

const fmt = (x: number | null) => (x === null ? "—" : x.toFixed(2));
const pct = (x: number | null) =>
  x === null ? "—" : `${Math.round(x * 100)}%`;

export function ItemsCard({
  load,
}: {
  load: () => Promise<ItemSummary | null>;
}) {
  const [data, setData] = useState<ItemSummary | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="card stack">
      <b>問ごとの質</b>
      {!data ? (
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setData(await load());
            setBusy(false);
          }}
        >
          {busy ? "読み込み中…" : "集計を見る"}
        </button>
      ) : (
        <>
          <p className="small">
            最近 {data.days} 日の回答 {data.responses}{" "}
            件（テストを除く）。基本の 16 問と、深掘りの 16
            問（出した人だけで数える）を見ています。
          </p>
          {data.axes.map((a) => (
            <div key={a.axis} className="stack" style={{ gap: 6 }}>
              <b className="small">
                {a.name}：まとまり（α）{fmt(a.alpha)}（{a.n} 件）
              </b>
              <div style={{ overflowX: "auto" }}>
                <table className="visit-table">
                  <thead>
                    <tr>
                      <th>問</th>
                      <th>平均</th>
                      <th>答えた数</th>
                      <th>ほかの問との相関</th>
                      <th>わからない</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.items.map((it) => (
                      <tr key={it.no}>
                        <th style={{ whiteSpace: "normal" }}>
                          Q{it.no}（{it.pole}
                          {it.stage === "follow" ? "・深掘り" : ""}）
                          {it.summary}
                        </th>
                        <td>{fmt(it.mean)}</td>
                        <td>{it.answered ?? "—"}</td>
                        <td>{fmt(it.itemRest)}</td>
                        <td>{pct(it.unknownRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="muted small">
            まとまり（α）は、同じ軸の 4 問が同じことを測れているかの目安で、0.7
            前後あれば十分です。「ほかの問との相関」が 0.3
            未満やマイナスの問は、言い方を見直す候補です。「わからない」が多い問は、友達から見えにくい行動です。平均は左の極（外向・現実・思考・計画）の向きにそろえた
            1〜7
            の点です。深掘りの問は、基本の答えが半々に近い人にだけ出るので、平均はふつう
            4 に近くなります。深掘りの問の平均が 4
            から大きく離れていたら、言い方が一方に寄っている（だれでも「そう思う」と答えやすい）おそれがあります。深掘りの問の相関は、同じ軸の基本の
            4 問の合計との相関です。回答が 30 件に届くまでは「—」と出します。
          </p>
        </>
      )}
    </section>
  );
}
