"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { forgetSurvey, hostApi } from "../lib/client";

export function DeleteSurvey({ hostKey }: { hostKey: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="btn danger" onClick={() => setAsk(true)}>
        この診断を消す
      </button>
      {ask && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-title"
        >
          <div className="dialog stack">
            <h2 id="del-title">本当に消しますか？</h2>
            <p>
              回答も結果もすべて消え、元に戻せません。招待リンクも使えなくなります。
            </p>
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await hostApi("", hostKey, { method: "DELETE" }).catch(
                  () => null,
                );
                forgetSurvey(hostKey);
                router.replace("/");
              }}
            >
              {busy ? "消しています…" : "消す"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setAsk(false)}
              disabled={busy}
            >
              やめる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
