"use client";
// タコ占い（仕様書 §4.11）。合言葉を入れると、カードが裏返って今日の占いが出る。
// 合言葉はアドレスの # の後ろでも受け取る（サーバーの記録に残らないように）
import { useEffect, useState } from "react";
import { Disclaimer, Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { GROUPS, groupOf } from "@/data/framework";
import type { Fortune } from "@/lib/fortune";
import { FortuneBody } from "@/components/FortuneBody";

export function FortunePage() {
  const [code, setCode] = useState("");
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(c: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/fortune", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: c }),
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 200) {
      const data = (await res.json()) as { fortune: Fortune };
      return setFortune(data.fortune);
    }
    setError(
      res?.status === 429
        ? "まちがいが多すぎます。1 時間ほど待ってください"
        : "合言葉がちがうようです。もう一度確かめてください",
    );
  }

  useEffect(() => {
    const fromHash = decodeURIComponent(window.location.hash.slice(1));
    if (!fromHash) return;
    // アドレスの合言葉を読んでから、すぐに消す（画面のアドレスに残さない）
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(fromHash);
    void open(fromHash);
  }, []);

  const group = fortune ? GROUPS[groupOf(fortune.type)] : null;
  return (
    <main
      className="page stack"
      style={
        group
          ? { ["--gc" as string]: group.ink, ["--gg" as string]: group.glow }
          : undefined
      }
    >
      <Header />
      <div className={`fortune-card ${fortune ? "flipped" : ""}`}>
        <div className="fortune-inner">
          <section className="fortune-face fortune-front card stack center">
            <Octopus code="INFJ" size={110} />
            <h1>タコ占い</h1>
            <p className="muted small">
              スペシャルなシェア画像の裏にかくれた「あなたのタコ占い」。応援のお礼にお届けした合言葉で見られます。
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) void open(code);
              }}
            >
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TAKO-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                aria-label="合言葉"
              />
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "占っています…" : "占う"}
              </button>
            </form>
            {error && (
              <p className="error small" role="alert">
                {error}
              </p>
            )}
            <p className="muted small">
              合言葉は、応援してくれた本人だけのものです。人に教えないでね。
            </p>
          </section>
          {fortune && (
            <section className="fortune-face fortune-back card stack">
              <FortuneBody fortune={fortune} />
            </section>
          )}
        </div>
      </div>
      <Disclaimer />
    </main>
  );
}
