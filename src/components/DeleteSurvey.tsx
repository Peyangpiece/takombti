"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { forgetSurvey, hostApi, useDialogFocus } from "../lib/client";

export function DeleteSurvey({
  hostKey,
  premium = false,
}: {
  hostKey: string;
  premium?: boolean;
}) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(ask, () => setAsk(false));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
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
          ref={dialogRef}
        >
          <div className="dialog stack">
            <h2 id="del-title">本当に消しますか？</h2>
            <p>
              回答も結果もすべて消え、元に戻せません。招待リンクも使えなくなります。
            </p>
            {premium && (
              <p className="error">
                支払った特典（くわしい分析・タコ占いの合言葉）も見られなくなります。返金はできません。
              </p>
            )}
            {failed && (
              <p className="error" role="alert">
                消せませんでした。通信の状態を確かめて、もう一度お試しください。
              </p>
            )}
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setFailed(false);
                const r = await hostApi("", hostKey, {
                  method: "DELETE",
                }).catch(() => null);
                // 消せた（または、もうない）ときだけ端末の鍵を捨てる。通信に失敗したのに捨てると、
                // 残っている診断にたどり着けなくなるため
                if (r && (r.ok || r.status === 404)) {
                  forgetSurvey(hostKey);
                  router.replace("/");
                  return;
                }
                setBusy(false);
                setFailed(true);
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
