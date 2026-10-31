"use client";
// 流入から診断の完成までの集計（仕様書 §11.11）。運営者のページに出す。
// どれも件数（同じ人の重複を含む）で、登録なしでは人を厳密に見分けられないので「人数」とは書かない
import { useState } from "react";
import { ENTRIES, ORIGINS, type FunnelEventLabel } from "@/data/funnel";
import type { FunnelSummary, GroupRow, Rate } from "@/lib/funnel";
import { isTester, setTester } from "@/lib/track";
import { useClientValue } from "@/lib/client";

const EVENTS: { id: FunnelEventLabel; label: string; note?: string }[] = [
  { id: "create_view", label: "作成画面の表示" },
  { id: "created", label: "診断の作成" },
  {
    id: "invite",
    label: "招待の操作",
    note: "押した回数。実際に送ったかは分からない",
  },
  { id: "answer_start", label: "回答の開始" },
  { id: "response", label: "回答の受け付け" },
  {
    id: "answer_time",
    label: "回答にかかった時間",
    note: "画面から答え終えた回答。所要時間の目安を見直すため",
  },
  { id: "completed", label: "診断の完成" },
  { id: "result_view", label: "結果の表示", note: "診断ごとに最初の 1 回" },
  {
    id: "image",
    label: "画像の保存・共有の操作",
    note: "投稿したかは分からない",
  },
  {
    id: "result_share",
    label: "結果を X・LINE で送る操作",
    note: "押した回数",
  },
  { id: "public_created", label: "公開リンクの作成" },
  {
    id: "group",
    label: "グループ診断",
    note: "グループの作成・参加・開始の件数。始めると 1 人に 1 つずつ診断ができ、入口「グループで一斉に」の作成として数える",
  },
];

const KEY_LABELS: Record<string, string> = {
  ...Object.fromEntries(ORIGINS.map((o) => [o.id, o.label])),
  copy_text: "文章＋リンクをコピー",
  copy_link: "リンクだけコピー",
  remind_line: "まだの人へ・LINE",
  remind_copy: "まだの人へ・文をコピー",
  created: "作成",
  joined: "参加",
  started: "開始",
  lt3: "3 分未満",
  "3to6": "3〜6 分",
  "6to10": "6〜10 分",
  ge10: "10 分以上",
  story_shared: "縦・共有の画面",
  story_downloaded: "縦・ダウンロード",
  wide_shared: "横・共有の画面",
  wide_downloaded: "横・ダウンロード",
};

function pct({ eligible, done }: Rate): string {
  return eligible > 0
    ? `${Math.round((done / eligible) * 100)}%（${done}/${eligible}）`
    : "—";
}

const md = (week: string) => week.slice(5).replace("-", "/");

function GroupTable({
  title,
  rows,
  label,
}: {
  title: string;
  rows: GroupRow[];
  label: (id: string) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <b className="small">{title}</b>
      <div style={{ overflowX: "auto" }}>
        <table className="visit-table">
          <thead>
            <tr>
              <th />
              <th>作成</th>
              <th>7 日以内に完成</th>
              <th>完成（これまで）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th>{label(r.id)}</th>
                <td>{r.created}</td>
                <td>{pct(r.within7d)}</td>
                <td>{r.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 招待リンク（/a/<ID>）か ID だけから、診断の ID を取り出す
function surveyIdOf(text: string): string | null {
  const m = /\/a\/([A-Za-z0-9_-]{16,64})/.exec(text);
  const id = m ? m[1] : text.trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(id) ? id : null;
}

export function FunnelCard({
  load,
  markTest,
}: {
  load: (includeTests: boolean) => Promise<FunnelSummary | null>;
  markTest: (surveyId: string, test: boolean) => Promise<boolean>;
}) {
  const [link, setLink] = useState("");
  const [marked, setMarked] = useState<string | null>(null);
  const [data, setData] = useState<FunnelSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const tester = useClientValue(isTester, false);
  const [testerNow, setTesterNow] = useState<boolean | null>(null);
  const testerOn = testerNow ?? tester;

  async function fetchData(includeTests: boolean) {
    setBusy(true);
    setData(await load(includeTests));
    setBusy(false);
  }

  return (
    <section className="card stack">
      <b>流入から診断の完成まで</b>
      {!data ? (
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => void fetchData(false)}
        >
          {busy ? "読み込み中…" : "集計を見る"}
        </button>
      ) : (
        <>
          <label className="small" style={{ display: "flex", gap: 8 }}>
            <input
              type="checkbox"
              checked={data.includeTests}
              disabled={busy}
              onChange={(e) => void fetchData(e.target.checked)}
            />
            テストの診断・操作も含める
          </label>

          <div className="stack" style={{ gap: 6 }}>
            <b className="small">主な指標：週ごとの完成した診断の数</b>
            <div style={{ overflowX: "auto" }}>
              <table className="visit-table">
                <thead>
                  <tr>
                    <th>週（月曜から）</th>
                    {data.weeklyCompleted.map((w) => (
                      <th key={w.week}>{md(w.week)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>完成</th>
                    {data.weeklyCompleted.map((w) => (
                      <td key={w.week}>
                        <b>{w.count}</b>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <b className="small">週ごとの件数</b>
            <div style={{ overflowX: "auto" }}>
              <table className="visit-table">
                <thead>
                  <tr>
                    <th />
                    {data.weekly.map((w) => (
                      <th key={w.week}>{md(w.week)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map((e) => (
                    <tr key={e.id}>
                      <th>{e.label}</th>
                      {data.weekly.map((w) => (
                        <td key={w.week}>{w.counts[e.id] ?? 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <b className="small">作った週ごとの完成率</b>
            <div style={{ overflowX: "auto" }}>
              <table className="visit-table">
                <thead>
                  <tr>
                    <th>作った週</th>
                    <th>作成</th>
                    <th>24 時間以内</th>
                    <th>7 日以内</th>
                    <th>最初の回答まで</th>
                    <th>3 人で作成</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((c) => (
                    <tr key={c.week}>
                      <th>{md(c.week)}</th>
                      <td>{c.created}</td>
                      <td>{pct(c.within24h)}</td>
                      <td>{pct(c.within7d)}</td>
                      <td>
                        {c.firstResponseHours === null
                          ? "—"
                          : `${c.firstResponseHours} 時間`}
                      </td>
                      <td>{c.threePeople}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              完成率の分母は、作ってから 24 時間（7
              日）たった診断だけです。最初の回答までは中央値（回答がまだない診断は入れない）。
            </p>
          </div>

          <GroupTable
            title="入口ごと（最近 8 週に作った診断）"
            rows={data.byEntry}
            label={(id) => ENTRIES.find((e) => e.id === id)?.label ?? id}
          />
          <GroupTable
            title="流入元ごと（最近 8 週に作った診断）"
            rows={data.byOrigin}
            label={(id) => KEY_LABELS[id] ?? id}
          />
          <GroupTable
            title="キャンペーンごと"
            rows={data.byCampaign}
            label={(id) => id}
          />

          <div className="stack" style={{ gap: 6 }}>
            <b className="small">最近 30 日の内訳</b>
            {EVENTS.filter((e) => data.byKey[e.id]).map((e) => (
              <p key={e.id} className="small">
                {e.label}：
                {Object.entries(data.byKey[e.id])
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => `${KEY_LABELS[k] ?? k} ${n}`)
                  .join("・")}
                {e.note ? `（${e.note}）` : ""}
              </p>
            ))}
          </div>
          <p className="muted small">
            どれも件数で、同じ人の重複を含みます（登録なしでは人を見分けられないため、人数ではありません）。作成・回答・完成・結果の表示・公開リンクは、サーバーの処理が成功したときに数えています。公開カードの表示は「どこから開かれたか」の表を見てください。計測はこの仕組みを入れた日からで、それより前の診断は入っていません。
          </p>
        </>
      )}
      <form
        className="notice stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const id = surveyIdOf(link);
          if (!id) return setMarked("招待リンクの形ではありません");
          const ok = await markTest(id, true);
          setMarked(
            ok
              ? "テストとして集計から外しました"
              : "見つかりませんでした（計測を入れる前に作った診断は対象外です）",
          );
          if (ok) setLink("");
        }}
      >
        <p className="small">
          作ってしまった診断をテストとして外す：招待リンクを貼り付ける
        </p>
        <input
          className="input"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…/a/…"
          aria-label="テストとして外す診断の招待リンク"
        />
        <button type="submit" className="btn secondary small">
          テストとして外す
        </button>
        {marked && (
          <p className="small" role="status">
            {marked}
          </p>
        )}
      </form>
      <div className="notice stack">
        <p className="small">
          この端末は
          <b>{testerOn ? "テスト用（集計から外す）" : "ふつう"}</b>
          です。テスト用にすると、この端末で作った診断と操作は、集計からはじめから外れます。
        </p>
        <button
          type="button"
          className="btn secondary small"
          onClick={() => {
            setTester(!testerOn);
            setTesterNow(!testerOn);
          }}
        >
          {testerOn ? "ふつうに戻す" : "この端末をテスト用にする"}
        </button>
      </div>
    </section>
  );
}
