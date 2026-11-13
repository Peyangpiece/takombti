import Link from "next/link";
import { Disclaimer, Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { VisitCounter } from "@/components/VisitCounter";
import { TYPE_CODES } from "@/data/framework";
import { GroupExplorer } from "./GroupExplorer";
import { MyGroups, MySurveys } from "./MySurveys";
import { OpenHostLink } from "./OpenHostLink";
import { SampleResult } from "./SampleResult";

// 使い方の 3 つの手順と、横に添えるタコ（幹事役の現場監督・考えこむ博士・お祝いのアイドル）
const STEPS: [string, string, string][] = [
  ["人数を決めてリンクを送る", "3〜30 人。LINE でそのまま送れます", "ESTJ"],
  [
    "友達が約 3 分で答える",
    "16 問・匿名。1 人ずつの答えは表示されません",
    "INTP",
  ],
  [
    "全員そろったら結果発表",
    "人数がそろうまで、結果はだれにも見えません",
    "ESFP",
  ],
];

// タコの行進（16 タイプが横に流れる。かざりなので読み上げない）。同じ並びを 2 回置いて切れ目なくつなぐ
function Parade() {
  return (
    <div className="parade" aria-hidden="true">
      <div className="parade-track">
        {[...TYPE_CODES, ...TYPE_CODES].map((code, i) => (
          <Octopus key={i} code={code} size={56} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="page wide stack">
      <VisitCounter page="top" />
      <Header
        right={
          <Link href="/new?entry=top" className="btn small desktop-only">
            診断をつくる
          </Link>
        }
      />
      <section className="hero">
        <div className="hero-art">
          <p className="bubble hero-bubble">わたしって、どう見えてる？</p>
          <div className="hero-mascots">
            <Octopus code="ENTJ" size={80} className="bob" />
            <Octopus code="INFP" size={104} className="bob" />
            <Octopus code="ESTJ" size={80} className="bob" />
            <Octopus code="ISFP" size={80} className="bob" />
          </div>
        </div>
        <div className="hero-text center stack">
          <h1>
            友達が答える、
            <br />
            あなたの 16 タイプ
          </h1>
          <p className="muted">
            自分で答える診断とはちがう、
            <wbr />
            「周りから見たあなた」が
            <wbr />
            わかる
          </p>
          <Link href="/new?entry=top" className="btn">
            診断をつくる（無料・登録なし）
          </Link>
        </div>
      </section>

      <Parade />

      <OpenHostLink place="top" />
      <MyGroups />
      <MySurveys />

      <section className="steps" aria-label="使い方">
        {STEPS.map(([title, body, tako], i) => (
          <div className="card" key={title}>
            <span className="num-badge">{i + 1}</span>
            <div>
              <b>{title}</b>
              <p className="muted small">{body}</p>
            </div>
            <Octopus code={tako} size={52} />
          </div>
        ))}
      </section>

      <SampleResult />

      <section className="stack">
        <h2>4 つの界隈・16 タイプ</h2>
        <GroupExplorer />
      </section>

      <OpenHostLink place="bottom" />

      <Disclaimer />
    </main>
  );
}
