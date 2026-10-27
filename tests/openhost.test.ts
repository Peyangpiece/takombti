// 管理用リンクから開く（仕様書 §4.2）：貼り付けた文から鍵を取り出す
import { describe, expect, it } from "vitest";
import { hostKeyFromText } from "../src/app/OpenHostLink";

const KEY = "abcdefghijklmnopqrstuv";

describe("hostKeyFromText", () => {
  it("管理用リンク・LINE に送った文・鍵だけ、のどれからでも取り出す", () => {
    expect(hostKeyFromText(`https://takoshin.daigakunote.com/h#${KEY}`)).toBe(
      KEY,
    );
    expect(
      hostKeyFromText(
        `たこ診の管理用リンク（自分だけ用・人に送らない）→ https://takoshin.daigakunote.com/h#${KEY}`,
      ),
    ).toBe(KEY);
    expect(hostKeyFromText(`  ${KEY} `)).toBe(KEY);
  });
  it("招待リンクや形のちがう文は受け付けない", () => {
    expect(
      hostKeyFromText(`https://takoshin.daigakunote.com/a/${KEY}`),
    ).toBeNull();
    expect(hostKeyFromText("こんにちは")).toBeNull();
  });
});
