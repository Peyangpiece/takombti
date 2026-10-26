"""たこ診のタコのイラスト（土台）を SVG で組み立てる。
色を変えた版や、16 タイプの描き分けは、この土台に部品を足して作る。"""
import sys

PALETTE = {
    "light": "#FFC4D0", "mid": "#FF8FA5", "dark": "#EE6384",
    "line": "#C2416A", "legFill": "#FF8CA3", "legShade": "#EC6E8C",
    "backLine": "#B53A60", "backFill": "#E46080",
    "sucker": "#FFE3E9", "suckerLine": "#E46A88",
    "blush": "#FF4D7D", "mouth": "#FF9DB1", "mouthLine": "#B23A5E", "mouthIn": "#9C2E52",
}

# 界隈ごとの色（考察＝青・エモ＝桃・ちゃんと＝緑・ノリ＝橙）。線は濃い同系色にする
GROUP_PALETTES = {
    "G1": dict(light="#C9D6FF", mid="#8FA6FF", dark="#5F7BF2", line="#3E55C4", legFill="#93A9FF",
               backLine="#3A4FB4", backFill="#6E86F0", sucker="#E6ECFF", suckerLine="#6F86E6",
               blush="#FF6FA0", mouth="#FFA9C0", mouthLine="#3E55C4", mouthIn="#2E3F94"),
    "G2": PALETTE,
    "G3": dict(light="#C8F2DE", mid="#7EDDB2", dark="#3FBF88", line="#1F8A5C", legFill="#84DFB6",
               backLine="#1D7F55", backFill="#46B985", sucker="#E3F8EE", suckerLine="#4BB585",
               blush="#FF6F8E", mouth="#FFA9B8", mouthLine="#1F8A5C", mouthIn="#17694A"),
    "G4": dict(light="#FFE0BF", mid="#FFB571", dark="#FF9233", line="#C8641A", legFill="#FFB977",
               backLine="#B95B16", backFill="#F59446", sucker="#FFF1E2", suckerLine="#E99248",
               blush="#FF6F7E", mouth="#FFB0A6", mouthLine="#B95B16", mouthIn="#8E4512"),
}

# 足の中心線（すべて外向きに巻く）。前の足は外側から内側の順に重ねる
FRONT_LEGS = [
    "M84 138 C 72 156, 56 166, 50 180 C 44 194, 58 203, 64 193",
    "M156 138 C 168 156, 184 166, 190 180 C 196 194, 182 203, 176 193",
    "M107 146 C 106 166, 103 184, 101 196 C 99 208, 84 207, 88 197",
    "M133 146 C 134 166, 137 184, 139 196 C 141 208, 156 207, 152 197",
]
BACK_LEGS = [
    "M72 128 C 56 142, 42 150, 32 158 C 22 166, 26 178, 36 174",
    "M168 128 C 184 142, 198 150, 208 158 C 218 166, 214 178, 204 174",
]
SUCKERS = [(51, 192, 2.7), (56, 198, 2.2), (189, 192, 2.7), (184, 198, 2.2),
           (92, 206, 2.7), (97, 205, 2.2), (148, 206, 2.7), (143, 205, 2.2)]


def svg(p=PALETTE, size=240, uid="t"):
    """uid は、1 つのページに何体並べても色の指定が混ざらないようにするための名前の前置き"""
    legs = []
    for d in BACK_LEGS:
        legs.append(f'<path d="{d}" stroke="{p["backLine"]}" stroke-width="20"/>')
        legs.append(f'<path d="{d}" stroke="{p["backFill"]}" stroke-width="14"/>')
    for d in FRONT_LEGS:
        legs.append(f'<path d="{d}" stroke="{p["line"]}" stroke-width="23"/>')
        legs.append(f'<path d="{d}" stroke="{p["legFill"]}" stroke-width="17"/>')
    suckers = "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in SUCKERS)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="{size}" height="{size}">
  <defs>
    <radialGradient id="{uid}-head" cx="38%" cy="28%" r="80%">
      <stop offset="0" stop-color="{p["light"]}"/>
      <stop offset="0.45" stop-color="{p["mid"]}"/>
      <stop offset="1" stop-color="{p["dark"]}"/>
    </radialGradient>
    <linearGradient id="{uid}-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.62" stop-color="{p["line"]}" stop-opacity="0"/>
      <stop offset="1" stop-color="{p["line"]}" stop-opacity="0.32"/>
    </linearGradient>
    <radialGradient id="{uid}-iris" cx="50%" cy="30%" r="75%">
      <stop offset="0" stop-color="#3B2844"/>
      <stop offset="0.65" stop-color="#271A30"/>
      <stop offset="1" stop-color="#5A3E70"/>
    </radialGradient>
    <radialGradient id="{uid}-blush" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="{p["blush"]}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="{p["blush"]}" stop-opacity="0"/>
    </radialGradient>
    <path id="{uid}-headPath" d="M120 26 C 170 26, 192 60, 192 98 C 192 132, 168 152, 120 152 C 72 152, 48 132, 48 98 C 48 60, 70 26, 120 26 Z"/>
    <clipPath id="{uid}-headClip"><use href="#{uid}-headPath"/></clipPath>
  </defs>
  <ellipse cx="120" cy="218" rx="66" ry="7" fill="#2B1B2E" opacity="0.10"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">{"".join(legs)}</g>
  <g fill="{p["sucker"]}" stroke="{p["suckerLine"]}" stroke-width="1">{suckers}</g>
  <use href="#{uid}-headPath" fill="url(#{uid}-head)"/>
  <rect x="40" y="20" width="160" height="140" fill="url(#{uid}-shade)" clip-path="url(#{uid}-headClip)"/>
  <use href="#{uid}-headPath" fill="none" stroke="{p["line"]}" stroke-width="3.2"/>
  <path d="M74 66 C 78 48, 96 38, 112 38" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity="0.7"/>
  <circle cx="124" cy="38" r="3.8" fill="#FFFFFF" opacity="0.7"/>
  <path d="M182 112 C 178 128, 168 138, 154 144" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.35"/>
  <g fill="{p["dark"]}" opacity="0.32"><circle cx="160" cy="58" r="6"/><circle cx="173" cy="76" r="4"/><circle cx="148" cy="44" r="3"/></g>
  <ellipse cx="74" cy="122" rx="15" ry="9" fill="url(#{uid}-blush)"/>
  <ellipse cx="166" cy="122" rx="15" ry="9" fill="url(#{uid}-blush)"/>
  <g>
    <ellipse cx="94" cy="104" rx="14.5" ry="17.5" fill="url(#{uid}-iris)"/>
    <ellipse cx="146" cy="104" rx="14.5" ry="17.5" fill="url(#{uid}-iris)"/>
    <circle cx="99" cy="96" r="6.5" fill="#FFFFFF"/>
    <circle cx="151" cy="96" r="6.5" fill="#FFFFFF"/>
    <circle cx="88.5" cy="110" r="2.6" fill="#FFFFFF"/>
    <circle cx="140.5" cy="110" r="2.6" fill="#FFFFFF"/>
  </g>
  <ellipse cx="120" cy="127" rx="7" ry="6" fill="{p["mouth"]}" stroke="{p["mouthLine"]}" stroke-width="2.6"/>
  <ellipse cx="120" cy="127.5" rx="2.6" ry="2.2" fill="{p["mouthIn"]}"/>
  <path d="M115.5 123.5 Q 118 122 120.5 122.4" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
</svg>
'''


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "octopus-base.svg"
    open(out, "w").write(svg())
    for gid, pal in GROUP_PALETTES.items():
        merged = {**PALETTE, **pal}
        open(out.replace(".svg", f"-{gid}.svg"), "w").write(svg(merged, uid=gid))
