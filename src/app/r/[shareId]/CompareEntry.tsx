"use client";
// 公開カード（S7）から「ほかの人のカードと並べる」（§4.15）。
// 貼り付けた公開カードの URL（または ID）の形を確かめてから、並べるページへ移る（サーバーでも確かめる）
import { useState } from "react";
import { useRouter } from "next/navigation";
import { compareTarget } from "@/lib/compare";

export function CompareEntry({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <button
        type="button"
        className="btn secondary"
        onClick={() => setOpen(true)}
      >
        ほかの人のカードと並べる
      </button>
    );

  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        const r = compareTarget(shareId, value);
        if (!r.ok) {
          setError(
            r.error === "self"
              ? "このカード自身のリンクです。ほかの人のカードを貼り付けてください"
              : "結果カードのリンクを貼り付けてください（/r/ のあとに英数字が続くリンク）",
          );
          return;
        }
        setError(null);
        router.push(r.path);
      }}
    >
      <label className="label" htmlFor="compare-url">
        ほかの人のカードと並べる
      </label>
      <p className="muted small">
        友達が公開した結果カードのリンクを貼り付けると、2 人のタイプと 4
        つの軸を並べて見られます。並べられるのは、公開中のカードだけです。
      </p>
      <input
        id="compare-url"
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://…/r/…"
        autoComplete="off"
        inputMode="url"
        aria-invalid={error !== null}
        aria-describedby={error ? "compare-error" : undefined}
      />
      {error && (
        <p id="compare-error" className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn" disabled={value.trim() === ""}>
        並べる
      </button>
    </form>
  );
}
