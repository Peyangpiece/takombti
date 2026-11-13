// たこ診のマスコット（仕様書 §0.5・§10.3）。
// 16 タイプそれぞれに、タイプ名に合った表情・ポーズ・持ち物がある（例：INTJ 軍師は半目の不敵な笑みでチェスの駒を掲げる）。
// 色は界隈のパステル色で、どのタイプにも目印の星のヘアピンが付く。
// 絵は design/build_mascot.py で組み立て、src/data/mascots.ts に書き出したものを使う。
// 中身は決まった図形だけで、利用者の入力は入らない。
// 手で仕上げたタイプ（RASTER_MASCOTS）は、SVG ではなく画像（public/mascots/<タイプ>.png）で描く。
// 小さく出すときは、軽い画像（public/mascots/s/<タイプ>.webp）を使う。

import { MASCOTS } from "../data/mascots";
import { RASTER_MASCOTS } from "../data/mascotCodes";

// 画像の差し替えのとき、古い画像がとっておかれたまま出ないよう、アドレスに版を付ける
const RASTER_VERSION = 1;

export function isRasterMascot(code: string): boolean {
  return RASTER_MASCOTS.includes(code);
}

// 小さく出すとき（この幅まで）は、幅 240px の軽い画像（public/mascots/s/<タイプ>.webp。1 枚 10KB ほど）を使う。
// 画素の細かい画面（3 倍）でも、80px までなら 240px の画像で足りる
const SMALL_MAX = 80;

export function mascotSrc(code: string, size: number): string {
  return size <= SMALL_MAX
    ? `/mascots/s/${code}.webp?v=${RASTER_VERSION}`
    : `/mascots/${code}.png?v=${RASTER_VERSION}`;
}

export function octopusSvg(code = "BASE", size = 120): string {
  const markup = MASCOTS[code] ?? MASCOTS.BASE;
  return markup.replace(
    /width="\d+" height="\d+"/,
    `width="${size}" height="${size}"`,
  );
}

interface Props {
  code?: string;
  size?: number;
  title?: string;
  className?: string;
  // 置く場所など（幅・高さは size で決める）
  style?: React.CSSProperties;
}

export function Octopus({
  code = "BASE",
  size = 120,
  title,
  className,
  style,
}: Props) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{
        ...style,
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: 0,
      }}
      {...(isRasterMascot(code)
        ? {}
        : { dangerouslySetInnerHTML: { __html: octopusSvg(code, size) } })}
    >
      {isRasterMascot(code) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mascotSrc(code, size)}
          alt=""
          width={size}
          height={size}
          draggable={false}
          style={{ width: size, height: size, display: "block" }}
        />
      ) : null}
    </span>
  );
}
