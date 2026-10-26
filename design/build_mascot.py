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

GROUP_OF = lambda code: ("G1" if code[2] == "T" else "G2") if code[1] == "N" else ("G3" if code[3] == "J" else "G4")
EYE_L, EYE_R, EYE_Y = 96, 144, 106
MOUTH = (120, 124)


def tube(paths, fill, width=15):
    """焦げ茶の輪郭つきの、太い管（腕・足）"""
    d = "".join(f'<path d="{p}"/>' for p in paths)
    return (
        f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">'
        f'<g stroke="{LINE}" stroke-width="{width + W}">{d}</g>'
        f'<g stroke="{fill}" stroke-width="{width}">{d}</g></g>'
    )


def heart_path(cx, cy, size):
    k = size / 12
    return (
        f'transform="translate({cx} {cy}) scale({k:.3f})" '
        'd="M0 9 C -3 6, -12 1.5, -12 -4 C -12 -8.5, -7.5 -11, -4 -9.5 C -2 -8.6, -0.8 -7, 0 -5.6 '
        'C 0.8 -7, 2 -8.6, 4 -9.5 C 7.5 -11, 12 -8.5, 12 -4 C 12 1.5, 3 6, 0 9 Z"'
    )


def ink(d, width=3.4, fill="none"):
    return f'<path d="{d}" fill="{fill}" stroke="{LINE}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'


# ---------- 表情 ----------

def eye_dot(x, c, dy=0, dx=0):
    return (f'<ellipse cx="{x + dx}" cy="{EYE_Y + dy}" rx="6.5" ry="8.5" fill="{c["eye"]}"/>'
            f'<circle cx="{x + dx + 2.2}" cy="{EYE_Y + dy - 3.7}" r="2.2" fill="#FFFFFF"/>')


def eye_sparkle(x, c):
    return (f'<ellipse cx="{x}" cy="{EYE_Y - 1}" rx="8" ry="10" fill="{c["eye"]}"/>'
            f'<circle cx="{x + 2.6}" cy="{EYE_Y - 5.5}" r="3.2" fill="#FFFFFF"/>'
            f'<path d="M{x - 3} {EYE_Y + 0.5} l 1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1 z" fill="#FFFFFF"/>')


def eye_happy(x):  # にっこり閉じた目（∩）
    return ink(f"M{x - 8} {EYE_Y + 3} Q {x} {EYE_Y - 7}, {x + 8} {EYE_Y + 3}", 4)


def eye_half(x, c):  # 半目（上まぶたが下りている）
    return (f'<path d="M{x - 7} {EYE_Y - 1} L {x + 7} {EYE_Y - 1} L {x + 6.5} {EYE_Y + 3} '
            f'Q {x} {EYE_Y + 11}, {x - 6.5} {EYE_Y + 3} Z" fill="{c["eye"]}"/>'
            + ink(f"M{x - 9} {EYE_Y - 1.5} L {x + 9} {EYE_Y - 1.5}", 3.4))


def eye_wink(x):  # ウインク（＞）
    return ink(f"M{x - 7} {EYE_Y - 5} L {x + 4} {EYE_Y} L {x - 7} {EYE_Y + 5}", 4)


def eyes(kind, c):
    if kind == "dot":
        return eye_dot(EYE_L, c) + eye_dot(EYE_R, c)
    if kind == "up":  # 上目づかい
        return eye_dot(EYE_L, c, dy=-3, dx=1) + eye_dot(EYE_R, c, dy=-3, dx=1)
    if kind == "side":  # 横目
        return eye_dot(EYE_L, c, dx=3) + eye_dot(EYE_R, c, dx=3)
    if kind == "sparkle":
        return eye_sparkle(EYE_L, c) + eye_sparkle(EYE_R, c)
    if kind == "teary":  # うるうる（きらきら＋なみだ）
        tear = f'<path d="M{EYE_R + 9} {EYE_Y + 6} q 4 6 0 9 q -4 -3 0 -9 z" fill="#9FD8FF" stroke="{LINE}" stroke-width="2"/>'
        return eye_sparkle(EYE_L, c) + eye_sparkle(EYE_R, c) + tear
    if kind == "happy":
        return eye_happy(EYE_L) + eye_happy(EYE_R)
    if kind == "half":
        return eye_half(EYE_L, c) + eye_half(EYE_R, c)
    if kind == "wink":
        return eye_dot(EYE_L, c) + eye_wink(EYE_R)
    raise ValueError(kind)


def brows(kind):
    if kind == "confident":  # 内側が下がる、きりっとした眉
        return ink(f"M{EYE_L - 9} {EYE_Y - 17} L {EYE_L + 7} {EYE_Y - 13}", 3.6) + ink(f"M{EYE_R + 9} {EYE_Y - 17} L {EYE_R - 7} {EYE_Y - 13}", 3.6)
    if kind == "flat":
        return ink(f"M{EYE_L - 8} {EYE_Y - 16} L {EYE_L + 7} {EYE_Y - 16}", 3.4) + ink(f"M{EYE_R - 7} {EYE_Y - 16} L {EYE_R + 8} {EYE_Y - 16}", 3.4)
    if kind == "soft":  # 下がり眉（やさしい・うるうる）
        return ink(f"M{EYE_L - 8} {EYE_Y - 13} Q {EYE_L} {EYE_Y - 18}, {EYE_L + 7} {EYE_Y - 17}", 3) + ink(f"M{EYE_R + 8} {EYE_Y - 13} Q {EYE_R} {EYE_Y - 18}, {EYE_R - 7} {EYE_Y - 17}", 3)
    if kind == "raised":  # 片眉を上げる
        return ink(f"M{EYE_R - 7} {EYE_Y - 18} Q {EYE_R} {EYE_Y - 23}, {EYE_R + 8} {EYE_Y - 19}", 3.2)
    return ""


def mouth(kind, c):
    x, y = MOUTH
    if kind == "o":
        return f'<circle cx="{x}" cy="{y}" r="5.8" fill="{c["mouth"]}" stroke="{LINE}" stroke-width="3.5"/>'
    if kind == "smile":
        return ink(f"M{x - 7} {y - 2} Q {x} {y + 6}, {x + 7} {y - 2}", 3.6)
    if kind == "flat":
        return ink(f"M{x - 5} {y} L {x + 5} {y}", 3.6)
    if kind == "smirk":
        return ink(f"M{x - 6} {y + 1} Q {x + 1} {y + 4}, {x + 7} {y - 3}", 3.6)
    if kind == "cat":  # ω
        return ink(f"M{x - 8} {y - 2} Q {x - 4} {y + 4}, {x} {y - 1} Q {x + 4} {y + 4}, {x + 8} {y - 2}", 3.2)
    if kind in ("grin", "tongue"):  # 口を開けた笑顔（tongue は舌を出す）
        open_d = f"M{x - 9} {y - 3} Q {x} {y - 1}, {x + 9} {y - 3} Q {x + 8} {y + 10}, {x} {y + 10} Q {x - 8} {y + 10}, {x - 9} {y - 3} Z"
        out = f'<path d="{open_d}" fill="#8E3B4F" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>'
        out += f'<ellipse cx="{x + (2 if kind == "tongue" else 0)}" cy="{y + (10 if kind == "tongue" else 6)}" rx="5" ry="{5 if kind == "tongue" else 3.4}" fill="{c["mouth"]}"' + (f' stroke="{LINE}" stroke-width="2.6"' if kind == "tongue" else "") + "/>"
        return out
    raise ValueError(kind)


def cheeks(kind, c):
    if kind == "heart":
        return "".join(f'<path {heart_path(x, 123, 9.5)} fill="{c["blush"]}"/>' for x in (78, 162))
    return f'<ellipse cx="78" cy="122" rx="11" ry="6.5" fill="{c["blush"]}"/><ellipse cx="162" cy="122" rx="11" ry="6.5" fill="{c["blush"]}"/>'


# ---------- ポーズ（腕） ----------
# back は頭の後ろ、front は頭と持ち物の手前に描く
POSES = {
    "wave": {"back": ["M60 130 C 44 128, 35 118, 34 104", "M182 142 C 196 148, 206 146, 210 138"]},
    "banzai": {"back": ["M58 130 C 40 124, 28 108, 26 90", "M182 130 C 200 124, 212 108, 214 90"]},
    # 両腕を体の前に回して、まん中で持ち物を抱える（I の手の自然な形）
    "hold": {"front": ["M52 134 C 56 152, 80 160, 102 152", "M188 134 C 184 152, 160 160, 138 152"]},
    "raise_r": {"back": ["M58 140 C 46 148, 38 148, 34 140", "M182 128 C 198 122, 206 110, 204 96"]},
    "point": {"back": ["M58 140 C 46 148, 38 148, 34 140", "M182 126 C 198 120, 210 112, 220 104"]},
    "chin": {"back": ["M182 142 C 194 150, 204 150, 208 142"], "front": ["M50 132 C 54 150, 80 154, 106 140"]},
    "fist": {"back": ["M58 140 C 46 148, 38 148, 34 140", "M182 130 C 198 128, 206 118, 202 102"]},
    "mic": {"back": ["M58 132 C 44 126, 36 116, 36 104"], "front": ["M190 134 C 186 150, 168 154, 152 146"]},
}


# ---------- 持ち物 ----------

def prop_knight(x, y):
    """チェスのナイト（脳内軍師）"""
    head = (f"M{x - 7} {y + 8} C {x - 6} {y + 2}, {x - 9} {y - 3}, {x - 6} {y - 8} C {x - 3} {y - 13}, {x + 4} {y - 14}, {x + 7} {y - 9} "
            f"C {x + 9} {y - 6}, {x + 9} {y - 3}, {x + 6} {y - 2} L {x + 1} {y - 3} C {x + 2} {y + 1}, {x + 5} {y + 4}, {x + 6} {y + 8} Z")
    return (f'<rect x="{x - 10}" y="{y + 8}" width="20" height="6" rx="2.5" fill="#FFF6E6" stroke="{LINE}" stroke-width="3"/>'
            f'<path d="{head}" fill="#FFF6E6" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
            f'<circle cx="{x + 1}" cy="{y - 8}" r="1.6" fill="{LINE}"/>')


def prop_question(x, y):
    return (f'<circle cx="{x}" cy="{y}" r="13" fill="#FFFFFF" stroke="{LINE}" stroke-width="3"/>'
            + ink(f"M{x - 4.5} {y - 4} C {x - 4.5} {y - 10}, {x + 4.5} {y - 10}, {x + 4.5} {y - 4} C {x + 4.5} {y}, {x} {y}, {x} {y + 3.5}", 3.2)
            + f'<circle cx="{x}" cy="{y + 8}" r="2" fill="{LINE}"/>')


def prop_bulb(x, y):
    rays = "".join(ink(f"M{x + dx * 15:.1f} {y + dy * 15:.1f} L {x + dx * 20:.1f} {y + dy * 20:.1f}", 2.8)
                   for dx, dy in [(-1, 0), (-0.7, -0.7), (0, -1), (0.7, -0.7), (1, 0)])
    return (rays + f'<circle cx="{x}" cy="{y}" r="10" fill="#FFF3A6" stroke="{LINE}" stroke-width="3"/>'
            f'<rect x="{x - 5}" y="{y + 8}" width="10" height="7" rx="2" fill="#D8D2E6" stroke="{LINE}" stroke-width="3"/>'
            f'<path d="M{x - 4} {y - 4} Q {x - 3} {y - 7}, {x} {y - 7}" stroke="#FFFFFF" stroke-width="2.4" fill="none" stroke-linecap="round"/>')


def prop_crystal(x, y):
    return (f'<path d="M{x - 13} {y + 15} L {x - 9} {y + 7} L {x + 9} {y + 7} L {x + 13} {y + 15} Z" fill="#B69CFF" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
            f'<circle cx="{x}" cy="{y - 3}" r="13" fill="#DCD0FF" stroke="{LINE}" stroke-width="3"/>'
            f'<path d="M{x - 7} {y - 6} Q {x - 5} {y - 12}, {x + 1} {y - 13}" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round"/>'
            f'<path d="M{x + 4} {y - 1} l 1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1 z" fill="#FFFFFF"/>')


def prop_flower(x, y):
    petals = "".join(f'<circle cx="{x + 7 * math.cos(math.radians(a)):.1f}" cy="{y - 8 + 7 * math.sin(math.radians(a)):.1f}" r="5.5" fill="#FFFFFF" stroke="{LINE}" stroke-width="2.6"/>'
                     for a in range(-90, 270, 72))
    return (ink(f"M{x} {y - 2} L {x} {y + 14}", 3.4)
            + f'<path d="M{x} {y + 8} q 7 -6 11 -2 q -5 6 -11 2 z" fill="#9BDDB8" stroke="{LINE}" stroke-width="2.4"/>'
            + petals + f'<circle cx="{x}" cy="{y - 8}" r="4.5" fill="#FFD84D" stroke="{LINE}" stroke-width="2.6"/>')


def prop_uchiwa(x, y, color):
    return (ink(f"M{x} {y + 10} L {x} {y + 24}", 4.5)
            + f'<circle cx="{x}" cy="{y}" r="14" fill="#FFFFFF" stroke="{LINE}" stroke-width="3"/>'
            + f'<path {heart_path(x, y + 1, 8.5)} fill="{color}" stroke="{LINE}" stroke-width="{2.4 / (8.5 / 12):.2f}"/>')


def prop_confetti():
    bits = [(26, 56, "#FFD84D", 0), (212, 66, "#9FD8FF", 30), (20, 100, "#FF9DBA", -20), (220, 104, "#B6E8A0", 15),
            (60, 26, "#CDB8FF", 40), (186, 30, "#FF9DBA", -30)]
    return "".join(f'<rect x="{x - 6}" y="{y - 3.5}" width="12" height="7" rx="2" transform="rotate({r} {x} {y})" fill="{col}" stroke="{LINE}" stroke-width="2.2"/>' for x, y, col, r in bits)


def prop_clipboard(x, y):
    return (f'<rect x="{x - 13}" y="{y - 14}" width="26" height="30" rx="4" fill="#E9C58F" stroke="{LINE}" stroke-width="3"/>'
            f'<rect x="{x - 9}" y="{y - 9}" width="18" height="21" rx="2" fill="#FFFFFF" stroke="{LINE}" stroke-width="2"/>'
            f'<rect x="{x - 6}" y="{y - 17}" width="12" height="6" rx="2" fill="#C9CED8" stroke="{LINE}" stroke-width="2.4"/>'
            + ink(f"M{x - 6} {y - 3} l 2.5 2.5 l 4 -5", 2.2) + ink(f"M{x - 6} {y + 5} l 2.5 2.5 l 4 -5", 2.2))


def prop_bandage(x, y):
    return (f'<rect x="{x - 17}" y="{y - 7}" width="34" height="14" rx="7" fill="#FFD9B8" stroke="{LINE}" stroke-width="3" transform="rotate(-12 {x} {y})"/>'
            f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" rx="2" fill="#FFF1E3" stroke="{LINE}" stroke-width="2" transform="rotate(-12 {x} {y})"/>'
            + "".join(f'<circle cx="{x + dx}" cy="{y + dy}" r="1" fill="{LINE}"/>' for dx, dy in [(-12, 2), (-11, -2), (11, -2), (12, 2)]))


def prop_flag(x, y):
    return (ink(f"M{x} {y + 18} L {x} {y - 16}", 3.4)
            + f'<path d="M{x + 1} {y - 16} L {x + 22} {y - 10} L {x + 1} {y - 3} Z" fill="#FF8597" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
            + f'<circle cx="{x}" cy="{y - 18}" r="3" fill="#FFD84D" stroke="{LINE}" stroke-width="2.4"/>')


def prop_camera(x, y):
    return (f'<rect x="{x - 17}" y="{y - 10}" width="34" height="23" rx="5" fill="#9AA7C7" stroke="{LINE}" stroke-width="3"/>'
            f'<rect x="{x - 8}" y="{y - 15}" width="12" height="6" rx="2" fill="#9AA7C7" stroke="{LINE}" stroke-width="2.6"/>'
            f'<circle cx="{x}" cy="{y + 1.5}" r="7.5" fill="#E8EEFF" stroke="{LINE}" stroke-width="3"/>'
            f'<circle cx="{x}" cy="{y + 1.5}" r="3" fill="{LINE}"/>'
            f'<circle cx="{x + 11}" cy="{y - 5}" r="2" fill="#FFD84D"/>')


def prop_wrench(x, y):
    return (f'<g transform="rotate(-35 {x} {y})">'
            f'<rect x="{x - 3.5}" y="{y - 4}" width="7" height="24" rx="3.5" fill="#C9CED8" stroke="{LINE}" stroke-width="3"/>'
            f'<path d="M{x - 9} {y - 14} C {x - 9} {y - 6}, {x - 4} {y - 3}, {x} {y - 3} C {x + 4} {y - 3}, {x + 9} {y - 6}, {x + 9} {y - 14} '
            f'L {x + 4} {y - 14} L {x + 4} {y - 9} L {x - 4} {y - 9} L {x - 4} {y - 14} Z" fill="#C9CED8" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/></g>')


def prop_brush(x, y):
    return (f'<g transform="rotate(30 {x} {y})">'
            f'<rect x="{x - 3}" y="{y - 4}" width="6" height="24" rx="3" fill="#E9B98A" stroke="{LINE}" stroke-width="2.8"/>'
            f'<rect x="{x - 4}" y="{y - 9}" width="8" height="6" rx="1.5" fill="#C9CED8" stroke="{LINE}" stroke-width="2.4"/>'
            f'<path d="M{x - 4} {y - 9} Q {x - 5} {y - 18}, {x} {y - 22} Q {x + 5} {y - 18}, {x + 4} {y - 9} Z" fill="#7FC8FF" stroke="{LINE}" stroke-width="2.6" stroke-linejoin="round"/></g>'
            )


def prop_paint():
    """絵の具のしずく（センスの塊）"""
    drops = [(38, 62, 5, "#FF9DBA"), (26, 82, 4, "#FFD84D"), (50, 42, 3.6, "#7FC8FF")]
    return "".join(f'<path d="M{x} {y - r * 1.6} Q {x + r} {y - r * 0.2}, {x} {y + r} Q {x - r} {y - r * 0.2}, {x} {y - r * 1.6} Z" '
                   f'fill="{col}" stroke="{LINE}" stroke-width="2.2" stroke-linejoin="round"/>' for x, y, r, col in drops)


def prop_motion():
    burst = "".join(ink(f"M{204 + 13 * math.cos(math.radians(a)):.1f} {92 + 13 * math.sin(math.radians(a)):.1f} L {204 + 21 * math.cos(math.radians(a)):.1f} {92 + 21 * math.sin(math.radians(a)):.1f}", 3.4)
                    for a in (-150, -110, -70, -30, 10))
    return burst + ink("M20 128 L 8 124", 3.2) + ink("M22 140 L 8 140", 3.2)


def prop_mic(x, y):
    return (f'<rect x="{x - 3.5}" y="{y}" width="7" height="18" rx="3" fill="#5A5F73" stroke="{LINE}" stroke-width="2.8" transform="rotate(25 {x} {y})"/>'
            f'<circle cx="{x}" cy="{y - 3}" r="7" fill="#C9CED8" stroke="{LINE}" stroke-width="3"/>')


def prop_notes():  # 音符
    def note(x, y, s=1.0):
        return (f'<ellipse cx="{x}" cy="{y}" rx="{4.5 * s}" ry="{3.5 * s}" fill="{LINE}" transform="rotate(-20 {x} {y})"/>'
                + ink(f"M{x + 4 * s} {y - 1} L {x + 4 * s} {y - 15 * s} L {x + 10 * s} {y - 12 * s}", 2.6))
    return note(194, 72, 1.3) + note(214, 98, 1.0)


def prop_exclaim(x, y):
    return ink(f"M{x} {y - 8} L {x} {y + 2}", 4) + f'<circle cx="{x}" cy="{y + 8}" r="2.4" fill="{LINE}"/>' + ink(f"M{x + 10} {y - 4} L {x + 14} {y - 9}", 3) + ink(f"M{x - 10} {y - 4} L {x - 14} {y - 9}", 3)


# ---------- 16 タイプの設定 ----------
# eyes / brows / mouth / cheeks / pose / props（(関数名, 引数) の並び）
TYPES = {
    "INTJ": dict(eyes="half", brows="confident", mouth="smirk", pose="raise_r", props=[("knight", 205, 82, 1.6)]),
    "INTP": dict(eyes="up", brows="raised", mouth="o", pose="chin", props=[("question", 44, 50, 1.35)]),
    "ENTJ": dict(eyes="dot", brows="confident", mouth="grin", pose="point", props=[("exclaim", 210, 68, 1.5)]),
    "ENTP": dict(eyes="sparkle", brows="raised", mouth="grin", pose="raise_r", props=[("bulb", 206, 76, 1.5)]),
    "INFJ": dict(eyes="happy", brows="soft", mouth="smile", cheeks="heart", pose="hold", props=[("crystal", 120, 148, 1.3)]),
    "INFP": dict(eyes="teary", brows="soft", mouth="smile", cheeks="heart", pose="hold", props=[("flower", 120, 150, 1.35)]),
    "ENFJ": dict(eyes="sparkle", mouth="grin", cheeks="heart", pose="raise_r", props=[("uchiwa", 206, 70, 1.4)]),
    "ENFP": dict(eyes="happy", mouth="grin", cheeks="heart", pose="banzai", props=[("confetti",)]),
    "ISTJ": dict(eyes="dot", brows="flat", mouth="flat", pose="hold", props=[("clipboard", 120, 150, 1.25)]),
    "ISFJ": dict(eyes="happy", brows="soft", mouth="smile", cheeks="heart", pose="hold", props=[("bandage", 120, 141, 1.4)]),
    "ESTJ": dict(eyes="dot", brows="confident", mouth="grin", pose="raise_r", props=[("flag", 202, 80, 1.4)]),
    "ESFJ": dict(eyes="happy", mouth="grin", cheeks="heart", pose="hold", props=[("camera", 120, 150, 1.25)]),
    "ISTP": dict(eyes="half", mouth="flat", pose="hold", props=[("wrench", 120, 148, 1.45)]),
    "ISFP": dict(eyes="side", mouth="cat", cheeks="heart", pose="hold", props=[("brush", 124, 148, 1.4), ("paint",)]),
    "ESTP": dict(eyes="wink", brows="confident", mouth="grin", pose="fist", props=[("motion",)]),
    "ESFP": dict(eyes="wink", mouth="tongue", cheeks="heart", pose="mic", props=[("mic", 152, 136, 1.45), ("notes",)]),
}


def draw_prop(spec, c):
    name, *args = spec
    fn = globals()[f"prop_{name}"]
    if len(args) == 3:  # (x, y, 大きさ)：その位置を中心に拡大する
        x, y, k = args
        inner = prop_uchiwa(x, y, c["blush"]) if name == "uchiwa" else fn(x, y)
        return f'<g transform="translate({x} {y}) scale({k}) translate({-x} {-y})">{inner}</g>'
    return fn(*args)


def svg(c=None, size=240, uid="m", code="ESTJ"):
    """code に合った表情・ポーズ・持ち物で描く。code が 16 タイプにないときは土台（手を振る・点の目・ちゅの口）"""
    t = TYPES.get(code, dict(eyes="dot", mouth="o", pose="wave", props=[]))
    if c is None:
        c = GROUPS.get(GROUP_OF(code), {}) if code in TYPES else {}
    c = {**BASE, **c}
    pose = POSES[t["pose"]]
    leg_lines = [f"M{x} 138 Q {x} {y - 6}, {x + dx} {y}" for x, y, dx in LEGS]
    suckers = "".join(f'<circle cx="{x + dx * 1.05:.1f}" cy="{y + 3}" r="2.6"/>' for x, y, dx in LEGS)
    props = "".join(draw_prop(p, c) for p in t["props"])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="{size}" height="{size}">
  <ellipse cx="120" cy="194" rx="60" ry="6" fill="{LINE}" opacity="0.10"/>
  {tube(leg_lines, c["body"], 18)}
  {tube(pose.get("back", []), c["body"], 15)}
  <g fill="{c["sucker"]}">{suckers}</g>
  <path d="{HEAD}" fill="{c["body"]}" stroke="{LINE}" stroke-width="{W}"/>
  <g fill="{c["spot"]}"><circle cx="176" cy="92" r="5"/><circle cx="166" cy="104" r="3.2"/></g>
  {hairpin()}
  <path d="M72 76 Q 80 60, 96 52" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  {cheeks(t.get("cheeks", "oval"), c)}
  {brows(t.get("brows", ""))}
  {eyes(t["eyes"], c)}
  {mouth(t["mouth"], c)}
  {props}
  {tube(pose.get("front", []), c["body"], 15)}
</svg>
'''


TYPE_CODES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
              "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]


if __name__ == "__main__":
    import os
    out = sys.argv[1] if len(sys.argv) > 1 else "mascot-base.svg"
    # 土台：手を振る・点の目・ふつうのほっぺ・ちょうネクタイもアホ毛もなし（3・4 文字目に X を入れる）
    open(out, "w").write(svg(BASE, code="ESXX"))
    for gid, pal in GROUPS.items():
        open(out.replace(".svg", f"-{gid}.svg"), "w").write(svg(pal, uid=gid, code="ESXX"))
    os.makedirs("types", exist_ok=True)
    for t in TYPE_CODES:
        open(f"types/{t}.svg", "w").write(svg(code=t, uid=t))

    # アプリで使うデータ（src/data/mascots.ts）を書き出す
    import json
    import re

    def compact(markup):
        return re.sub(r">\s+<", "><", markup.strip())

    entries = {"BASE": compact(svg(BASE, code="ESXX"))}
    entries.update({t: compact(svg(code=t, uid=t)) for t in TYPE_CODES})
    here = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(here, "..", "src", "data", "mascots.ts")
    with open(target, "w") as f:
        f.write("// このファイルは design/build_mascot.py が書き出したもの。手で直さない\n")
        f.write("// 直すときは: python3 design/build_mascot.py design/mascot-base.svg\n")
        f.write("export const MASCOTS: Record<string, string> = ")
        f.write(json.dumps(entries, ensure_ascii=False, indent=2))
        f.write(";\n")
