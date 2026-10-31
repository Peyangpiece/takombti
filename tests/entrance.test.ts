// 入口（仕様書 §4.10 回答完了の見本・§4.14 タイプの紹介の「友達から見たら、あなたは何タイプ？」）
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SAMPLE_AXES,
  SAMPLE_CODE,
  SamplePreview,
} from "../src/components/SamplePreview";
import { isEntry } from "../src/data/funnel";
import TypePage, { generateStaticParams } from "../src/app/types/[code]/page";

describe("結果の見本", () => {
  it("見本の 4 軸は、見本のタイプの 4 文字と合う", () => {
    expect(SAMPLE_AXES.map((a) => a.pole).join("")).toBe(SAMPLE_CODE);
  });
  it("回答完了の画面の小さな見本は、見本だと書き、タイプと 4 軸だけを出す", () => {
    const html = renderToStaticMarkup(createElement(SamplePreview));
    expect(html).toContain("見本：たろうは友達");
    expect(html).toContain(SAMPLE_CODE);
    expect(html.match(/class="meter"/g)).toHaveLength(4);
    // データでわかるあなたの文（insight）は入れない
    expect(html).not.toContain("insight");
  });
});

describe("タイプの紹介の入口", () => {
  it("「友達から見たら、あなたは何タイプ？」から、入口 types の作成画面と見本へつなぐ", async () => {
    expect(isEntry("types")).toBe(true);
    const html = renderToStaticMarkup(
      await TypePage({ params: Promise.resolve({ code: "intj" }) }),
    );
    expect(html).toContain("友達から見たら、あなたは何タイプ？");
    expect(html).toContain('href="/new?entry=types"');
    expect(html).toContain('href="/#sample"');
  });
  it("16 タイプだけを前もって作る（静的なまま）", () => {
    expect(generateStaticParams()).toHaveLength(16);
  });
});
