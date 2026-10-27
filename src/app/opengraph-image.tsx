import { ImageResponse } from "next/og";

export const alt = "たこ診｜友達が答える16タイプ診断";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function font(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@900&text=${encodeURIComponent(text)}`,
      )
    ).text();
    const url = css.match(
      /src: url\((.+?)\) format\('(opentype|truetype)'\)/,
    )?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const text = "たこ診友達が答える16タイプ診断";
  const data = await font(text);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#C9334A",
        color: "#fff",
        fontFamily: "Noto Sans JP",
      }}
    >
      <div style={{ fontSize: 160, fontWeight: 900 }}>たこ診</div>
      <div style={{ fontSize: 56, fontWeight: 900 }}>
        友達が答える16タイプ診断
      </div>
    </div>,
    {
      ...size,
      fonts: data
        ? [{ name: "Noto Sans JP", data, weight: 900, style: "normal" }]
        : undefined,
    },
  );
}
