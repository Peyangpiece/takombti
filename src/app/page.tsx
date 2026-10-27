import Link from "next/link";
import { Disclaimer, Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { VisitCounter } from "@/components/VisitCounter";
import { GroupExplorer } from "./GroupExplorer";
import { MySurveys } from "./MySurveys";
import { OpenHostLink } from "./OpenHostLink";
import { SampleResult } from "./SampleResult";

export default function Home() {
  return (
    <main className="page wide stack">
      <VisitCounter page="top" />
      <Header
        right={
          <Link href="/new" className="btn small desktop-only">
            診断をつくる
          </Link>
        }
      />
      <section className="hero">
        <div className="hero-mascots">
          <Octopus code="ENTJ" size={72} />
          <Octopus code="INFP" size={88} />
          <Octopus code="ESTJ" size={72} />
          <Octopus code="ISFP" size={72} />
        </div>
        <div className="hero-text center stack">
          <h1>
            友達が答える、
            <br />
            あなたの 16 タイプ
          </h1>
          <p className="muted">
            自分で答える診断とはちがう、「周りから見たあなた」がわかる
          </p>
          <Link href="/new" className="btn">
            診断をつくる（無料・登録なし）
          </Link>
        </div>
      </section>

      <OpenHostLink place="top" />
      <MySurveys />

      <section className="steps" aria-label="使い方">
        {[
          ["人数を決めてリンクを送る", "3〜30 人。LINE でそのまま送れます"],
          [
            "友達が 3 分で答える",
            "16〜32 問・匿名。だれが何と答えたかは見えません",
          ],
          [
            "全員そろったら結果発表",
            "人数がそろうまで、結果はだれにも見えません",
          ],
        ].map(([title, body], i) => (
          <div className="card" key={title}>
            <span className="num-badge">{i + 1}</span>
            <div>
              <b>{title}</b>
              <p className="muted small">{body}</p>
            </div>
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
