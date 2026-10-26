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
