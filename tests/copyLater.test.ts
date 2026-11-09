import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextLater } from "../src/lib/client";

// iPhone の Safari のように、押したその場（同じ処理の中）で書き込みを始めないと止める clipboard を作る
function safariLike() {
  const written: string[] = [];
  let calledSync = false;
  let inClick = false;
  class FakeItem {
    constructor(public items: Record<string, Promise<Blob>>) {}
  }
  const clipboard = {
    write: vi.fn(async (items: FakeItem[]) => {
      if (!inClick) throw new Error("NotAllowedError");
      calledSync = true;
      const blob = await items[0].items["text/plain"];
      written.push(await blob.text());
    }),
    writeText: vi.fn(async () => {
      if (!inClick) throw new Error("NotAllowedError");
    }),
  };
  vi.stubGlobal("ClipboardItem", FakeItem);
  vi.stubGlobal("navigator", { clipboard });
  return {
    written,
    clipboard,
    get calledSync() {
      return calledSync;
    },
    // 押したときの処理：この中で同期的に呼ばれたものだけを許す
    click<T>(fn: () => T): T {
      inClick = true;
      try {
        return fn();
      } finally {
        inClick = false;
      }
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyTextLater（あとでできる文のコピー。§4.12）", () => {
  it("押したその場で書き込みを始め、中身はできてから渡す（Safari で止められない）", async () => {
    const env = safariLike();
    let resolve!: (s: string) => void;
    const text = new Promise<string | null>((r) => (resolve = r));
    const done = env.click(() => copyTextLater(text));
    expect(env.clipboard.write).toHaveBeenCalledTimes(1);
    // 公開リンクができるのは、押したあと（通信のあと）
    await Promise.resolve();
    resolve("https://example.com/r/abc?from=copy");
    expect(await done).toBe(true);
    expect(env.written).toEqual(["https://example.com/r/abc?from=copy"]);
  });

  it("（比べるため）待ってからコピーする前のやり方は、Safari では止められる", async () => {
    const env = safariLike();
    const old = env.click(async () => {
      const t = await Promise.resolve("https://example.com/r/abc");
      await navigator.clipboard.writeText(t);
    });
    await expect(old).rejects.toThrow("NotAllowedError");
  });

  it("作れなかった（null）ときはコピーしない", async () => {
    const env = safariLike();
    const done = env.click(() => copyTextLater(Promise.resolve(null)));
    expect(await done).toBe(false);
    expect(env.written).toEqual([]);
  });

  it("ClipboardItem がなければ、できてからふつうにコピーする", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyTextLater(Promise.resolve("abc"))).toBe(true);
    expect(writeText).toHaveBeenCalledWith("abc");
  });
});
