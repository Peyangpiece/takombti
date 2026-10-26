import { describe, expect, it } from "vitest";
import { isMobileUserAgent, lineShareUrl } from "../src/lib/client";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.0.0";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("LINE で送る", () => {
  it("スマホかどうかを見分ける", () => {
    expect(isMobileUserAgent(IPHONE)).toBe(true);
    expect(isMobileUserAgent(ANDROID)).toBe(true);
    expect(isMobileUserAgent(MAC, 5)).toBe(true); // iPad の Safari
    expect(isMobileUserAgent(MAC, 0)).toBe(false);
    expect(isMobileUserAgent(WINDOWS)).toBe(false);
  });

  it("スマホでは line.me/R/share に、文とリンクをまとめて渡す", () => {
    const href = lineShareUrl(
      "答えて！ #たこ診 →",
      "https://t.example/a/x",
      true,
    );
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe("https://line.me/R/share");
    expect(u.searchParams.get("text")).toBe(
      "答えて！ #たこ診 → https://t.example/a/x",
    );
  });

  it("パソコンでは、ウェブで送れる LINE の共有を使う", () => {
    const href = lineShareUrl("答えて！", "https://t.example/h#key", false);
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe(
      "https://social-plugins.line.me/lineit/share",
    );
    expect(u.searchParams.get("url")).toBe("https://t.example/h#key");
    expect(u.searchParams.get("text")).toBe("答えて！");
  });
});
