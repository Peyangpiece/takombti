"use client";
// Stripe の支払いのページから戻る先（仕様書 §4.11）。
// 戻り先には管理用の鍵を入れていないので、支払いの前に端末に覚えた結果の画面へ戻る。
// 支払いの知らせ（Webhook）が届いて特典が開くまで、少し待つ
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { RETURN_KEY } from "@/components/SupportCard";
import { hostApi } from "@/lib/client";

type State = "waiting" | "canceled" | "late" | "lost";

function returnUrl(): string | null {
  try {
    const v = window.sessionStorage.getItem(RETURN_KEY);
    return v && new URL(v).origin === window.location.origin ? v : null;
  } catch {
    return null;
  }
}

export function ThanksPage() {
  const [state, setState] = useState<State>("waiting");
  const [back, setBack] = useState<string | null>(null);

  useEffect(() => {
    const url = returnUrl();
    const canceled = new URLSearchParams(window.location.search).has(
      "canceled",
    );
    // 状態は、端末に覚えた行き先と支払いの結果を読んでから決める
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBack(url);
    if (canceled) return setState("canceled");
    const hostKey = url ? new URL(url).hash.slice(1) : "";
    if (!hostKey) return setState("lost");
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      tries += 1;
      const r = await hostApi<{ premium?: boolean }>("", hostKey).catch(
        () => null,
      );
      if (r?.data.premium) {
        try {
          window.sessionStorage.removeItem(RETURN_KEY);
        } catch {
          // 何もしない
        }
        window.location.replace(url!);
        return;
      }
      if (tries >= 15) return setState("late");
      setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, []);

  return (
    <main className="page stack center" style={{ paddingTop: 24 }}>
      <Header />
      <Octopus code="ESFJ" size={120} />
      {state === "waiting" && (
        <>
          <h1>応援ありがとうございます！</h1>
          <p>特典を開いています。少しだけお待ちください…</p>
        </>
      )}
      {state === "canceled" && (
        <>
          <h1>支払いを取りやめました</h1>
          <p>お金はかかっていません。</p>
        </>
      )}
      {state === "late" && (
        <>
          <h1>応援ありがとうございます！</h1>
          <p>
            特典が開くまで、少し時間がかかっています。結果の画面を開き直すと、特典が出ているはずです。
          </p>
        </>
      )}
      {state === "lost" && (
        <>
          <h1>応援ありがとうございます！</h1>
          <p>
            特典は、支払った診断の結果の画面に出ます。管理用のリンク（トップの「つくった診断」）から結果の画面を開いてください。
          </p>
        </>
      )}
      {state !== "waiting" &&
        (back ? (
          <a href={back} className="btn">
            結果の画面へ戻る
          </a>
        ) : (
          <Link href="/" className="btn">
            トップへ
          </Link>
        ))}
    </main>
  );
}
