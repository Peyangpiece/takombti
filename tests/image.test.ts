// シェア画像が作れること（仕様書 §4.12）
import { describe, expect, it } from "vitest";
import { renderResultImage } from "../src/lib/image";

const view = {
  nickname: "たろう",
  n: 5,
  type: "ENFP" as const,
  axes: [
    { axis: "A1" as const, pole: "E" as const, percent: 72, tie: false },
    { axis: "A2" as const, pole: "N" as const, percent: 61, tie: false },
    { axis: "A3" as const, pole: "F" as const, percent: 50, tie: true },
    { axis: "A4" as const, pole: "P" as const, percent: 88, tie: false },
  ],
};

describe("シェア画像", () => {
  for (const size of ["story", "wide"] as const) {
    it(size, async () => {
      const res = await renderResultImage(view, size);
      const buf = new Uint8Array(await res.arrayBuffer());
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(
        [...buf.slice(1, 4)].map((c) => String.fromCharCode(c)).join(""),
      ).toBe("PNG");
    });
  }
});

describe("シェア画像のサイトのアドレス・自分で思うタイプ", () => {
  it("アドレスはホスト名だけ。設定がない・おかしいときは入れない", async () => {
    const { siteHost } = await import("../src/lib/image");
    expect(siteHost("https://takoshin.daigakunote.com")).toBe(
      "takoshin.daigakunote.com",
    );
    expect(siteHost("")).toBeNull();
    expect(siteHost("not a url")).toBeNull();
  });

  it("自分で思うタイプは、ど真ん中の軸がないときだけ入れられる", async () => {
    const { shareableSelfType } = await import("../src/lib/scoring");
    const axis = (tie: boolean) => ({
      axis: "A1" as const,
      pole: "E" as const,
      percent: 60,
      tie,
      gap: "match" as const,
    });
    expect(shareableSelfType(null)).toBeNull();
    expect(
      shareableSelfType({ type: "ENFP", axes: [axis(false)], summary: null }),
    ).toBe("ENFP");
    expect(
      shareableSelfType({
        type: "ENFP",
        axes: [axis(false), axis(true)],
        summary: null,
      }),
    ).toBeNull();
  });

  for (const size of ["story", "wide"] as const) {
    it(`自分で思うタイプを入れても作れる（${size}）`, async () => {
      const res = await renderResultImage(view, size, false, false, "ISTJ");
      expect(res.headers.get("content-type")).toBe("image/png");
    });
  }
});
