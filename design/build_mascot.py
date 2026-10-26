"""たこ診のマスコット（土台）を SVG で組み立てる。
サンリオのキャラクターに共通する描き方の特徴（平らなパステルの塗り・太さが一定の焦げ茶の線・
大きな丸い頭と小さな体・小さな点の目）を取り入れた、自前のキャラクター。"""
import math
import sys

LINE = "#5A3A3A"
W = 4.5  # 線の太さ（どこも同じ）
BASE = {
    "body": "#FFB8C6", "spot": "#FF9DB2", "blush": "#FF8FA8",
    "mouth": "#FF7E9B", "eye": "#3B2626", "sucker": "#FFE4EA",
}
GROUPS = {
    "G1": {"body": "#AFC6FF", "spot": "#93AEF7", "blush": "#FF9DBA", "mouth": "#FF8FAE", "sucker": "#E5ECFF"},
    "G2": {},
    "G3": {"body": "#AEE8CB", "spot": "#8FD7B4", "blush": "#FF9DB0", "mouth": "#FF8FA3", "sucker": "#E4F8EE"},
    "G4": {"body": "#FFCFA0", "spot": "#FDB97C", "blush": "#FF9A9A", "mouth": "#FF8C8C", "sucker": "#FFF0E0"},
}

STAR_FILL = "#FFE27A"
STAR_SHADE = "#FFC94D"
BOW_FILL = "#CDB8FF"


def star_points(cx, cy, r_out, r_in, rot_deg):
    pts = []
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot_deg - 90 + 36 * i)
        pts.append(f"{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}")
    return " ".join(pts)


def puffy_star(cx, cy, r_out, r_in, rot, round_w=7):
    """角を丸めた、ぷっくりした星。線の太さで角を丸め、外側に焦げ茶の輪郭を付ける"""
    pts = star_points(cx, cy, r_out, r_in, rot)
    return (
        f'<polygon points="{pts}" fill="{LINE}" stroke="{LINE}" stroke-width="{round_w + 2 * W}" stroke-linejoin="round"/>'
        f'<polygon points="{pts}" fill="{STAR_FILL}" stroke="{STAR_FILL}" stroke-width="{round_w}" stroke-linejoin="round"/>'
    )


def bow(cx, cy, rot, scale=1.0):
    """小さなリボン（左右のふっくらした輪と、まん中の結び目）"""
    loop = "M0 0 C -7 -12, -23 -14, -23 -2 C -23 10, -7 9, 0 0 Z"
    return f'''<g transform="translate({cx} {cy}) rotate({rot}) scale({scale})" stroke="{LINE}" stroke-width="{3.6 / scale:.2f}" stroke-linejoin="round">
    <path d="{loop}" fill="{BOW_FILL}"/>
    <path d="{loop}" fill="{BOW_FILL}" transform="scale(-1 1)"/>
    <path d="M-17 -4 Q -13 -8, -8 -5" fill="none" stroke="#FFFFFF" stroke-width="{2.6 / scale:.2f}" stroke-linecap="round"/>
    <path d="M9 -2 Q 13 -4, 16 -1" fill="none" stroke="#FFFFFF" stroke-width="{2.0 / scale:.2f}" stroke-linecap="round" opacity="0.8"/>
    <ellipse cx="0" cy="0" rx="5.4" ry="6" fill="{BOW_FILL}"/>
  </g>'''


def twinkle(cx, cy, r):
    return (
        f'<path d="M{cx} {cy - r} Q {cx + r * 0.22} {cy - r * 0.22}, {cx + r} {cy} Q {cx + r * 0.22} {cy + r * 0.22}, '
        f'{cx} {cy + r} Q {cx - r * 0.22} {cy + r * 0.22}, {cx - r} {cy} Q {cx - r * 0.22} {cy - r * 0.22}, {cx} {cy - r} Z" '
        f'fill="{STAR_FILL}" stroke="{LINE}" stroke-width="2.4" stroke-linejoin="round"/>'
    )


def hairpin():
    """目印の小物：星のヘアピン。ぷっくりした星と、手前に結んだ小さなリボン"""
    cx, cy = 162, 50
    return f'''
  <g>
    {puffy_star(cx, cy, 21, 12.5, -6, round_w=8)}
    <ellipse cx="{cx - 7}" cy="{cy - 6}" rx="4.6" ry="2.8" fill="#FFFFFF" transform="rotate(-38 {cx - 7} {cy - 6})"/>
    <circle cx="{cx + 1}" cy="{cy - 12}" r="1.8" fill="#FFFFFF"/>
    {bow(cx - 17, cy + 17, -16, 1.0)}
    {twinkle(194, 30, 6)}
    {twinkle(130, 28, 3.6)}
  </g>'''


HEAD = "M120 38 C 172 38, 198 72, 198 104 C 198 138, 166 156, 120 156 C 74 156, 42 138, 42 104 C 42 72, 68 38, 120 38 Z"
# 頭の下からのぞく 6 本の足（短いカプセル形）。外側ほど短くして奥行きを出す
# (付け根の x, 先の y, 先が外へずれる量)
LEGS = [(68, 160, -10), (89, 166, -6), (110, 169, -2), (130, 169, 2), (151, 166, 6), (172, 160, 10)]
ARM_L = "M60 130 C 44 128, 35 118, 34 104"  # 手を振る
ARM_R = "M182 142 C 196 148, 206 146, 210 138"


def svg(c=None, size=240, uid="m"):
    c = {**BASE, **(c or {})}
    leg_lines = "".join(f'<path d="M{x} 138 Q {x} {y - 6}, {x + dx} {y}"/>' for x, y, dx in LEGS)
    suckers = "".join(f'<circle cx="{x + dx * 1.05:.1f}" cy="{y + 3}" r="2.6"/>' for x, y, dx in LEGS)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="{size}" height="{size}">
  <ellipse cx="120" cy="194" rx="60" ry="6" fill="{LINE}" opacity="0.10"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="{LINE}" stroke-width="{18 + W}">{leg_lines}<path d="{ARM_L}"/><path d="{ARM_R}"/></g>
    <g stroke="{c["body"]}" stroke-width="18">{leg_lines}<path d="{ARM_L}"/><path d="{ARM_R}"/></g>
  </g>
  <g fill="{c["sucker"]}">{suckers}</g>
  <path d="{HEAD}" fill="{c["body"]}" stroke="{LINE}" stroke-width="{W}"/>
  <g fill="{c["spot"]}">
    <circle cx="176" cy="92" r="5"/><circle cx="166" cy="104" r="3.2"/>
  </g>{hairpin()}
  <path d="M72 76 Q 80 60, 96 52" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="78" cy="122" rx="11" ry="6.5" fill="{c["blush"]}"/>
  <ellipse cx="162" cy="122" rx="11" ry="6.5" fill="{c["blush"]}"/>
  <ellipse cx="96" cy="106" rx="6.5" ry="8.5" fill="{c["eye"]}"/>
  <ellipse cx="144" cy="106" rx="6.5" ry="8.5" fill="{c["eye"]}"/>
  <circle cx="98.2" cy="102.3" r="2.2" fill="#FFFFFF"/>
  <circle cx="146.2" cy="102.3" r="2.2" fill="#FFFFFF"/>
  <circle cx="120" cy="121" r="5.8" fill="{c["mouth"]}" stroke="{LINE}" stroke-width="3.5"/>
</svg>
'''


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "mascot-base.svg"
    open(out, "w").write(svg())
    for gid, pal in GROUPS.items():
        open(out.replace(".svg", f"-{gid}.svg"), "w").write(svg(pal, uid=gid))
