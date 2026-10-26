// たこ診のマスコット（仕様書 §0.5・§10.3）。
// 16 タイプそれぞれに、タイプ名に合った表情・ポーズ・持ち物がある（例：INTJ 軍師は半目の不敵な笑みでチェスの駒を掲げる）。
// 色は界隈のパステル色で、どのタイプにも目印の星のヘアピンが付く。
// 絵は design/build_mascot.py で組み立て、src/data/mascots.ts に書き出したものを使う。
// 中身は決まった図形だけで、利用者の入力は入らない。

import { MASCOTS } from "../data/mascots";

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
}

export function Octopus({
  code = "BASE",
  size = 120,
  title,
  className,
}: Props) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: 0,
      }}
      dangerouslySetInnerHTML={{ __html: octopusSvg(code, size) }}
    />
  );
}
