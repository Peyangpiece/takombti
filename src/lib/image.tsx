// 結果のシェア画像（仕様書 §4.12）。縦 1080×1920 と横 1200×630。
// 入れるのは：呼び名・4 文字・界隈・タイプ名・キャッチ・4 軸の %・回答人数・アプリ名。
// special は、特典つきの応援で開くスペシャル版（金の枠・きらめき・SPECIAL の札。§4.11）
import { ImageResponse } from "next/og";
import { AXES, GROUPS, POLE_LABEL, getType, groupOf } from "../data/framework";
import { octopusSvg } from "../components/Octopus";
import type { SharedView } from "./surveys";

export type ImageSize = "story" | "wide";

function octopusDataUrl(code: string, size: number): string {
  return `data:image/svg+xml;base64,${Buffer.from(octopusSvg(code, size)).toString("base64")}`;
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

const GOLD = "#E9C46A";

// きらめき（角を立てたひし形）
function sparkle(x: number, y: number, r: number) {
  return (
    <div
      key={`${x}-${y}`}
      style={{
        position: "absolute",
        left: x - r / 2,
        top: y - r / 2,
        width: r,
        height: r,
        background: GOLD,
        transform: "rotate(45deg)",
        borderRadius: r * 0.15,
      }}
    />
  );
}

export async function renderResultImage(
  view: SharedView,
  size: ImageSize,
  special = false,
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
    "SPECIAL",
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
          position: "relative",
          background: special
            ? `linear-gradient(160deg, ${group.ink} 0%, #2B2140 100%)`
            : group.ink,
          border: special ? `${story ? 18 : 10}px solid ${GOLD}` : "none",
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
          {special && (
            <div
              style={{
                display: "flex",
                fontSize: 30 * s + 6,
                fontWeight: 900,
                letterSpacing: 6,
                padding: "4px 22px",
                marginBottom: 12 * s,
                borderRadius: 999,
                background: GOLD,
                color: "#3B2626",
              }}
            >
              SPECIAL
            </div>
          )}
          <div style={{ display: "flex", fontSize: 36 * s + 4, opacity: 0.9 }}>
            {`${view.nickname}は友達${view.n}人から見ると`}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={octopusDataUrl(view.type, story ? 380 : 220)}
            width={story ? 380 : 220}
            height={story ? 380 : 220}
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
        {special &&
          (story
            ? [
                sparkle(120, 140, 34),
                sparkle(960, 220, 26),
                sparkle(150, 900, 22),
                sparkle(940, 1000, 34),
                sparkle(180, 1760, 26),
                sparkle(900, 1740, 22),
              ]
            : [
                sparkle(60, 60, 20),
                sparkle(1140, 70, 16),
                sparkle(70, 570, 16),
                sparkle(1130, 560, 20),
              ])}
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
