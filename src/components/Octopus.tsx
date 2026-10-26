// たこ診のキャラクター（仕様書 §0.5・§10.3）。
// 4 文字によって姿が変わる 16 体。色は界隈の色。
//   E：腕を上げて手を振る ／ I：腕を体に寄せる
//   S：まるい目           ／ N：きらきらの目
//   T：めがね             ／ F：ほっぺとにっこり口
//   J：きちんとしたリボン ／ P：ゆれるアホ毛
// 画面とシェア画像で同じ絵を使うため、SVG の文字列として組み立てる。
// 中身は決まった図形だけで、利用者の入力は入らない。

import { GROUPS, groupOf } from "../data/framework";

export function octopusSvg(code: string, color?: string, size = 120): string {
  const fill = color ?? GROUPS[groupOf(code)].color;
  const e = code[0] === "E";
  const n = code[1] === "N";
  const t = code[2] === "T";
  const j = code[3] === "J";
  const dark = "#2B2B3A";
  const star = (x: number) =>
    `<path d="M${x} 47 l1.2 2.4 2.4 1.2 -2.4 1.2 -1.2 2.4 -1.2 -2.4 -2.4 -1.2 2.4 -1.2 z" fill="#fff"/>`;
  const parts = [
    `<g fill="${fill}">`,
    `<path d="M34 72 q-6 22 -18 26 q10 4 22 -10 z"/>`,
    `<path d="M48 78 q-4 24 -12 32 q12 0 18 -24 z"/>`,
    `<path d="M72 78 q4 24 12 32 q-12 0 -18 -24 z"/>`,
    `<path d="M86 72 q6 22 18 26 q-10 4 -22 -10 z"/>`,
    e
      ? `<path d="M28 60 q-16 -6 -20 -26 q8 2 10 10 q4 8 14 10 z"/><path d="M92 60 q16 -6 20 -26 q-8 2 -10 10 q-4 8 -14 10 z"/>`
      : `<path d="M30 62 q-10 8 -4 18 q6 4 14 -2 q-8 -4 -4 -10 z"/><path d="M90 62 q10 8 4 18 q-6 4 -14 -2 q8 -4 4 -10 z"/>`,
    `<ellipse cx="60" cy="50" rx="34" ry="32"/>`,
    `</g>`,
    `<ellipse cx="48" cy="34" rx="9" ry="6" fill="#fff" opacity="0.28"/>`,
    n
      ? `<g fill="${dark}"><circle cx="47" cy="52" r="6"/><circle cx="73" cy="52" r="6"/></g>${star(49)}${star(75)}`
      : `<g fill="${dark}"><circle cx="47" cy="52" r="4.5"/><circle cx="73" cy="52" r="4.5"/></g><g fill="#fff"><circle cx="48.5" cy="50.5" r="1.4"/><circle cx="74.5" cy="50.5" r="1.4"/></g>`,
    t
      ? `<g fill="none" stroke="${dark}" stroke-width="2"><circle cx="47" cy="52" r="9"/><circle cx="73" cy="52" r="9"/><path d="M56 52 h8"/></g>`
      : `<g fill="#FF8FB1" opacity="0.75"><ellipse cx="38" cy="62" rx="5" ry="3"/><ellipse cx="82" cy="62" rx="5" ry="3"/></g>`,
    t
      ? `<path d="M54 66 q6 3 12 0" fill="none" stroke="${dark}" stroke-width="2.2" stroke-linecap="round"/>`
      : `<path d="M52 64 q8 9 16 0 z" fill="${dark}"/>`,
    j
      ? `<g fill="${dark}"><path d="M60 20 l-10 -6 v12 z"/><path d="M60 20 l10 -6 v12 z"/><circle cx="60" cy="20" r="3"/></g>`
      : `<path d="M60 19 q-2 -10 6 -12 q-6 4 -2 12" fill="none" stroke="${fill}" stroke-width="4" stroke-linecap="round"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">${parts.join("")}</svg>`;
}

interface Props {
  code?: string;
  color?: string;
  size?: number;
  title?: string;
  className?: string;
}

export function Octopus({
  code = "ENFP",
  color,
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
      dangerouslySetInnerHTML={{ __html: octopusSvg(code, color, size) }}
    />
  );
}
