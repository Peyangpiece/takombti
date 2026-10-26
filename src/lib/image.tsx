// 結果のシェア画像（仕様書 §4.12）。縦 1080×1920 と横 1200×630。
// 入れるのは：呼び名・4 文字・界隈・タイプ名・キャッチ・4 軸の %・回答人数・アプリ名。
import { ImageResponse } from "next/og";
import { AXES, GROUPS, POLE_LABEL, getType, groupOf } from "../data/framework";
import { octopusSvg } from "../components/Octopus";
import type { SharedView } from "./surveys";

export type ImageSize = "story" | "wide";

function octopusDataUrl(code: string, color: string, size: number): string {
  return `data:image/svg+xml;base64,${Buffer.from(octopusSvg(code, color, size)).toString("base64")}`;
}

const SIZES = {
  story: { width: 1080, height: 1920 },
  wide: { width: 1200, height: 630 },
};

// 日本語の字形を持つフォントを、使う文字だけ取り寄せる。失敗したら字形なしで描く
async function loadFont(
  text: string,
  weight: number,
): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function renderResultImage(
  view: SharedView,
  size: ImageSize,
): Promise<Response> {
  const type = getType(view.type);
  const group = GROUPS[groupOf(view.type)];
  const { width, height } = SIZES[size];
  const story = size === "story";
  const axes = view.axes.map((a) => {
    const def = AXES.find((x) => x.axis === a.axis)!;
    return { ...a, left: def.left, right: def.right };
  });
  const allText = [
    "たこ診",
    "友達が答える16タイプ診断",
    `${view.nickname}は友達${view.n}人から見ると`,
    group.name,
    type.name,
    type.catch,
    view.type,
    ...axes.flatMap((a) => [
      POLE_LABEL[a.left].name,
      POLE_LABEL[a.right].name,
      `${a.percent}%`,
    ]),
    "0123456789%人",
  ].join("");
  const [bold, black] = await Promise.all([
    loadFont(allText, 700),
    loadFont(allText, 900),
  ]);
  const fonts = [
    ...(bold
      ? [
          {
            name: "Noto Sans JP",
            data: bold,
            weight: 700 as const,
            style: "normal" as const,
          },
        ]
      : []),
    ...(black
      ? [
          {
            name: "Noto Sans JP",
            data: black,
            weight: 900 as const,
            style: "normal" as const,
          },
        ]
      : []),
  ];
  const s = story ? 1 : 0.5;

  const meters = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28 * s,
        width: "100%",
      }}
    >
      {axes.map((a) => {
        const leftWins = a.pole === a.left;
        const leftPct = leftWins ? a.percent : 100 - a.percent;
        return (
          <div
            key={a.axis}
            style={{ display: "flex", flexDirection: "column", gap: 10 * s }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 34 * s,
              }}
            >
              <span style={{ opacity: leftWins ? 1 : 0.6 }}>
                {leftWins
                  ? `${POLE_LABEL[a.left].name} ${a.percent}%`
                  : POLE_LABEL[a.left].name}
              </span>
              <span style={{ opacity: leftWins ? 0.6 : 1 }}>
                {leftWins
                  ? POLE_LABEL[a.right].name
                  : `${a.percent}% ${POLE_LABEL[a.right].name}`}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                height: 18 * s,
                borderRadius: 999,
                background: "rgba(255,255,255,0.25)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: leftWins ? 0 : `${leftPct}%`,
                  width: `${a.percent}%`,
                  borderRadius: 999,
                  background: "#fff",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: story ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: story ? 40 : 48,
          padding: story ? "120px 90px" : "48px 64px",
          background: group.ink,
          color: "#fff",
          fontFamily: "Noto Sans JP",
          fontWeight: 700,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            ...(story ? {} : { flex: 1 }),
          }}
        >
          <div style={{ display: "flex", fontSize: 36 * s + 4, opacity: 0.9 }}>
            {`${view.nickname}は友達${view.n}人から見ると`}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={octopusDataUrl(view.type, "#ffffff", story ? 360 : 200)}
            width={story ? 360 : 200}
            height={story ? 360 : 200}
            alt=""
          />
          <div
            style={{
              display: "flex",
              fontSize: 34 * s + 6,
              padding: "6px 24px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.22)",
            }}
          >
            {group.name}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: story ? 120 : 72,
              fontWeight: 900,
              letterSpacing: 12,
            }}
          >
            {view.type}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: story ? 84 : 48,
              fontWeight: 900,
              lineHeight: 1.2,
            }}
          >
            {type.name}
          </div>
          <div style={{ display: "flex", fontSize: 40 * s + 6, marginTop: 12 }}>
            {type.catch}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 40 * s,
            width: story ? "100%" : 480,
          }}
        >
          {meters}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 24 * s,
            }}
          >
            <div
              style={{ display: "flex", fontSize: 52 * s + 8, fontWeight: 900 }}
            >
              たこ診
            </div>
            <div
              style={{ display: "flex", fontSize: 28 * s + 6, opacity: 0.85 }}
            >
              友達が答える16タイプ診断
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: fonts.length > 0 ? fonts : undefined,
      headers: { "cache-control": "private, max-age=3600" },
    },
  );
}
