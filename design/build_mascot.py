"""たこ診のマスコット（土台）を SVG で組み立てる。
サンリオのキャラクターに共通する描き方の特徴（平らなパステルの塗り・太さが一定の焦げ茶の線・
大きな丸い頭と小さな体・小さな点の目）を取り入れた、自前のキャラクター。"""
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
    <circle cx="160" cy="66" r="7"/><circle cx="175" cy="84" r="4.2"/><circle cx="148" cy="53" r="3.4"/>
  </g>
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
