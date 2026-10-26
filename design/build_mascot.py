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


def bow(cx, cy, rot, scale=1.0, fill=BOW_FILL):
    """小さなリボン（左右のふっくらした輪と、まん中の結び目）"""
    loop = "M0 0 C -7 -12, -23 -14, -23 -2 C -23 10, -7 9, 0 0 Z"
    return f'''<g transform="translate({cx} {cy}) rotate({rot}) scale({scale})" stroke="{LINE}" stroke-width="{3.6 / scale:.2f}" stroke-linejoin="round">
    <path d="{loop}" fill="{fill}"/>
    <path d="{loop}" fill="{fill}" transform="scale(-1 1)"/>
    <path d="M-17 -4 Q -13 -8, -8 -5" fill="none" stroke="#FFFFFF" stroke-width="{2.6 / scale:.2f}" stroke-linecap="round"/>
    <path d="M9 -2 Q 13 -4, 16 -1" fill="none" stroke="#FFFFFF" stroke-width="{2.0 / scale:.2f}" stroke-linecap="round" opacity="0.8"/>
    <ellipse cx="0" cy="0" rx="5.4" ry="6" fill="{fill}"/>
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
# 目・眉・口・顔の小物を、タイプごとに違う組み合わせにする（同じ顔のタイプを作らない）。
# 左右の向き：EYE_L は見る人から見て左の目、EYE_R は右の目。
# 閉じた目の「＞」「＜」は、とがった先が鼻（顔のまん中）を向くように描く

def eye_dot(x, c, dy=0, dx=0, k=1.0):
    return (f'<ellipse cx="{x + dx}" cy="{EYE_Y + dy}" rx="{7.5 * k}" ry="{10 * k}" fill="{c["eye"]}"/>'
            f'<circle cx="{x + dx + 2.6 * k}" cy="{EYE_Y + dy - 4.3 * k}" r="{2.6 * k}" fill="#FFFFFF"/>')


def eye_sparkle(x, c, k=1.0):  # 大きなきらきらの目
    return (f'<ellipse cx="{x}" cy="{EYE_Y - 1}" rx="{9.5 * k}" ry="{12 * k}" fill="{c["eye"]}"/>'
            f'<circle cx="{x + 3 * k}" cy="{EYE_Y - 6.5 * k}" r="{3.8 * k}" fill="#FFFFFF"/>'
            f'<circle cx="{x - 3.5 * k}" cy="{EYE_Y + 4 * k}" r="{1.8 * k}" fill="#FFFFFF"/>')


def eye_teary(x, c):  # うるうる：大きな目の下半分に涙の光
    return (eye_sparkle(x, c, 1.15)
            + f'<path d="M{x - 9} {EYE_Y + 5} Q {x} {EYE_Y + 13}, {x + 9} {EYE_Y + 5}" stroke="#BFE6FF" stroke-width="3" fill="none" stroke-linecap="round"/>')


def eye_happy(x):  # にっこり閉じた目（∩）
    return ink(f"M{x - 9} {EYE_Y + 4} Q {x} {EYE_Y - 9}, {x + 9} {EYE_Y + 4}", 4.4)


def eye_peace(x, toward):  # おだやかに閉じた目（‿）にまつげ
    out = ink(f"M{x - 9} {EYE_Y} Q {x} {EYE_Y + 9}, {x + 9} {EYE_Y}", 4)
    ex = x + 9 * toward  # 外側の目じり
    return out + ink(f"M{ex} {EYE_Y} l {4 * toward} -3", 3)


def eye_smug(x):  # ドヤ顔の閉じ目（下にふくらむ平たい弧）
    return ink(f"M{x - 10} {EYE_Y - 1} Q {x} {EYE_Y + 5}, {x + 10} {EYE_Y - 1}", 4.4)


def eye_half(x, c):  # 半目（上まぶたが下りている）
    return (f'<path d="M{x - 8} {EYE_Y} L {x + 8} {EYE_Y} L {x + 7.5} {EYE_Y + 4} '
            f'Q {x} {EYE_Y + 13}, {x - 7.5} {EYE_Y + 4} Z" fill="{c["eye"]}"/>'
            + ink(f"M{x - 10} {EYE_Y - 0.5} L {x + 10} {EYE_Y - 0.5}", 3.6))


def eye_jito(x, c):  # ジト目（細い横長）
    return (f'<rect x="{x - 8}" y="{EYE_Y + 1}" width="16" height="6" rx="3" fill="{c["eye"]}"/>'
            + ink(f"M{x - 11} {EYE_Y - 1} L {x + 11} {EYE_Y - 1}", 3.4))


def eye_determined(x, c, toward):  # 吊り目（上が斜めに切れた目）。toward は鼻の向き（+1 / -1）
    inner, outer = x + 8 * toward, x - 8 * toward
    return (f'<path d="M{outer} {EYE_Y - 7} L {inner} {EYE_Y - 1} L {inner} {EYE_Y + 6} '
            f'Q {x} {EYE_Y + 14}, {outer} {EYE_Y + 6} Z" fill="{c["eye"]}" stroke="{c["eye"]}" stroke-width="2" stroke-linejoin="round"/>'
            f'<circle cx="{x - 1.5 * toward}" cy="{EYE_Y + 2}" r="2.2" fill="#FFFFFF"/>')


def eye_closed_v(x, toward):  # ＞＜ の片方。先が鼻を向く
    tip, back = x + 5 * toward, x - 7 * toward
    return ink(f"M{back} {EYE_Y - 7} L {tip} {EYE_Y} L {back} {EYE_Y + 7}", 4.4)


def eye_spiral(x):  # ぐるぐる目
    pts = []
    for i in range(0, 76):
        a = i * 0.18
        r = 0.8 + a * 0.78
        pts.append(f"{x + r * math.cos(a):.1f} {EYE_Y + r * math.sin(a):.1f}")
    return ink("M" + " L ".join(pts), 2.6)


def eye_star(x, c):  # 星の目
    pts = star_points(x, EYE_Y, 12, 5.6, -90)
    return (f'<polygon points="{pts}" fill="#FFD84D" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
            f'<circle cx="{x + 2.5}" cy="{EYE_Y - 2.5}" r="1.8" fill="#FFFFFF"/>')


def eye_heart(x, c):  # ハートの目
    return (f'<path {heart_path(x, EYE_Y + 1, 13)} fill="#FF5E8A" stroke="{LINE}" stroke-width="{3 / (13 / 12):.2f}"/>'
            f'<circle cx="{x + 4}" cy="{EYE_Y - 4}" r="2" fill="#FFFFFF"/>')


def eye_dreamy(x, c):  # うっとり：上を見る目に、下まつげ
    return (eye_dot(x, c, dy=-3, dx=-3, k=0.95)
            + ink(f"M{x - 9} {EYE_Y + 9} Q {x - 3} {EYE_Y + 12}, {x + 4} {EYE_Y + 9}", 2.6))


def eyes(kind, c):
    if kind == "dot":
        return eye_dot(EYE_L, c) + eye_dot(EYE_R, c)
    if kind == "base":  # 土台の小さな点の目
        return eye_dot(EYE_L, c, k=0.86) + eye_dot(EYE_R, c, k=0.86)
    if kind == "sparkle":
        return eye_sparkle(EYE_L, c) + eye_sparkle(EYE_R, c)
    if kind == "teary":
        tear = f'<path d="M{EYE_R + 11} {EYE_Y + 8} q 5 7 0 11 q -5 -4 0 -11 z" fill="#9FD8FF" stroke="{LINE}" stroke-width="2.2"/>'
        return eye_teary(EYE_L, c) + eye_teary(EYE_R, c) + tear
    if kind == "happy":
        return eye_happy(EYE_L) + eye_happy(EYE_R)
    if kind == "peace":
        return eye_peace(EYE_L, -1) + eye_peace(EYE_R, 1)
    if kind == "smug":
        return eye_smug(EYE_L) + eye_smug(EYE_R)
    if kind == "half":
        return eye_half(EYE_L, c) + eye_half(EYE_R, c)
    if kind == "jito":
        return eye_jito(EYE_L, c) + eye_jito(EYE_R, c)
    if kind == "determined":
        return eye_determined(EYE_L, c, 1) + eye_determined(EYE_R, c, -1)
    if kind == "xx":  # ＞＜
        return eye_closed_v(EYE_L, 1) + eye_closed_v(EYE_R, -1)
    if kind == "spiral":
        return eye_spiral(EYE_L) + eye_spiral(EYE_R)
    if kind == "star":
        return eye_star(EYE_L, c) + eye_star(EYE_R, c)
    if kind == "heart":
        return eye_heart(EYE_L, c) + eye_heart(EYE_R, c)
    if kind == "dreamy":
        return eye_dreamy(EYE_L, c) + eye_dreamy(EYE_R, c)
    if kind == "wink":  # 見る人から見て右の目を閉じる。閉じた目は「＜」（先が鼻を向く）
        return eye_sparkle(EYE_L, c) + eye_closed_v(EYE_R, -1)
    raise ValueError(kind)


def brows(kind):
    if kind == "confident":  # 内側が下がる、きりっとした眉
        return ink(f"M{EYE_L - 11} {EYE_Y - 20} L {EYE_L + 8} {EYE_Y - 14}", 4) + ink(f"M{EYE_R + 11} {EYE_Y - 20} L {EYE_R - 8} {EYE_Y - 14}", 4)
    if kind == "flat":
        return ink(f"M{EYE_L - 9} {EYE_Y - 19} L {EYE_L + 8} {EYE_Y - 19}", 3.6) + ink(f"M{EYE_R - 8} {EYE_Y - 19} L {EYE_R + 9} {EYE_Y - 19}", 3.6)
    if kind == "soft":  # 下がり眉（やさしい・うるうる）
        return ink(f"M{EYE_L - 10} {EYE_Y - 15} Q {EYE_L} {EYE_Y - 22}, {EYE_L + 8} {EYE_Y - 21}", 3.2) + ink(f"M{EYE_R + 10} {EYE_Y - 15} Q {EYE_R} {EYE_Y - 22}, {EYE_R - 8} {EYE_Y - 21}", 3.2)
    if kind == "worried":  # ハの字の困り眉
        return ink(f"M{EYE_L - 9} {EYE_Y - 16} L {EYE_L + 8} {EYE_Y - 22}", 3.4) + ink(f"M{EYE_R + 9} {EYE_Y - 16} L {EYE_R - 8} {EYE_Y - 22}", 3.4)
    if kind == "raised":  # 片眉を上げる（右）、左はきりっと
        return (ink(f"M{EYE_L - 10} {EYE_Y - 15} L {EYE_L + 8} {EYE_Y - 12}", 3.8)
                + ink(f"M{EYE_R - 8} {EYE_Y - 21} Q {EYE_R} {EYE_Y - 28}, {EYE_R + 10} {EYE_Y - 22}", 3.6))
    if kind == "up":  # 高く上がった、驚き・わくわくの眉
        return ink(f"M{EYE_L - 9} {EYE_Y - 21} Q {EYE_L} {EYE_Y - 28}, {EYE_L + 9} {EYE_Y - 22}", 3.4) + ink(f"M{EYE_R - 9} {EYE_Y - 22} Q {EYE_R} {EYE_Y - 28}, {EYE_R + 9} {EYE_Y - 21}", 3.4)
    return ""


def mouth(kind, c):
    x, y = MOUTH
    if kind == "chu":  # 土台のちゅっとすぼめた口
        return f'<circle cx="{x}" cy="{y}" r="5.8" fill="{c["mouth"]}" stroke="{LINE}" stroke-width="3.5"/>'
    if kind == "o":
        return f'<ellipse cx="{x}" cy="{y + 1}" rx="5" ry="6" fill="#8E3B4F" stroke="{LINE}" stroke-width="3.4"/>'
    if kind == "smile":
        return ink(f"M{x - 9} {y - 3} Q {x} {y + 7}, {x + 9} {y - 3}", 3.8)
    if kind == "flat":
        return ink(f"M{x - 6} {y} L {x + 6} {y}", 3.8)
    if kind == "smirk":  # 片方だけ上がる口
        return ink(f"M{x - 9} {y + 2} Q {x + 1} {y + 5}, {x + 10} {y - 5}", 3.8)
    if kind == "cat":  # ω
        return ink(f"M{x - 10} {y - 2} Q {x - 5} {y + 5}, {x} {y - 1} Q {x + 5} {y + 5}, {x + 10} {y - 2}", 3.4)
    if kind == "wavy":  # ふにゃっとした口
        return ink(f"M{x - 10} {y + 1} Q {x - 5} {y - 4}, {x} {y + 1} Q {x + 5} {y + 6}, {x + 10} {y + 1}", 3.4)
    if kind == "teeth":  # ニシシ：歯を見せる横長の笑い
        d = f"M{x - 13} {y - 4} Q {x} {y - 1}, {x + 13} {y - 4} Q {x + 11} {y + 9}, {x} {y + 9} Q {x - 11} {y + 9}, {x - 13} {y - 4} Z"
        return (f'<path d="{d}" fill="#FFFFFF" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
                + ink(f"M{x - 11} {y + 2} Q {x} {y + 4}, {x + 11} {y + 2}", 2.2)
                + ink(f"M{x} {y - 2} L {x} {y + 9}", 2) + ink(f"M{x - 6} {y - 3} L {x - 6} {y + 8}", 2) + ink(f"M{x + 6} {y - 3} L {x + 6} {y + 8}", 2))
    if kind in ("grin", "laugh", "tongue"):  # 口を開けた笑顔。laugh は大口、tongue は舌を出す
        w, h = (14, 18) if kind == "laugh" else (10, 12)
        open_d = f"M{x - w} {y - 4} Q {x} {y - 1}, {x + w} {y - 4} Q {x + w - 1} {y + h}, {x} {y + h} Q {x - w + 1} {y + h}, {x - w} {y - 4} Z"
        out = f'<path d="{open_d}" fill="#8E3B4F" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
        if kind == "tongue":
            out += f'<ellipse cx="{x + 3}" cy="{y + h - 0.5}" rx="6" ry="6.5" fill="{c["mouth"]}" stroke="{LINE}" stroke-width="2.8"/>'
            out += ink(f"M{x + 3} {y + h - 4} L {x + 3} {y + h + 1}", 1.8)
        else:
            out += f'<ellipse cx="{x}" cy="{y + h - 4}" rx="{w * 0.55}" ry="{h * 0.28}" fill="{c["mouth"]}"/>'
        return out
    if kind == "shout":  # 号令の口（縦長に大きく開く）
        return (f'<ellipse cx="{x}" cy="{y + 4}" rx="8" ry="10" fill="#8E3B4F" stroke="{LINE}" stroke-width="3.4"/>'
                f'<ellipse cx="{x}" cy="{y + 9}" rx="4.5" ry="3" fill="{c["mouth"]}"/>')
    raise ValueError(kind)


def cheeks(kind, c):
    if kind == "heart":
        return "".join(f'<path {heart_path(x, 124, 10)} fill="{c["blush"]}"/>' for x in (76, 164))
    if kind == "blush":  # 照れ：斜線入りの大きめのほっぺ
        out = "".join(f'<ellipse cx="{x}" cy="123" rx="13" ry="7.5" fill="{c["blush"]}"/>' for x in (76, 164))
        return out + "".join(ink(f"M{x + d} 119 l -3 7", 2) for x in (76, 164) for d in (-4, 1, 6))
    if kind == "none":
        return ""
    return f'<ellipse cx="76" cy="123" rx="11" ry="6.5" fill="{c["blush"]}"/><ellipse cx="164" cy="123" rx="11" ry="6.5" fill="{c["blush"]}"/>'


# 顔に重ねる小物（めがね・汗など）
def face_glasses():  # 四角いめがね（まじめ）
    rims = "".join(f'<rect x="{x - 14}" y="{EYE_Y - 12}" width="28" height="24" rx="7" fill="#FFFFFF" fill-opacity="0.25" stroke="{LINE}" stroke-width="3.6"/>' for x in (EYE_L, EYE_R))
    return rims + ink(f"M{EYE_L + 14} {EYE_Y - 2} Q 120 {EYE_Y - 7}, {EYE_R - 14} {EYE_Y - 2}", 3.2) + \
        f'<path d="M{EYE_L - 7} {EYE_Y - 7} l 5 -3" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>'


def face_sunglasses():  # サングラス（おでこに上げる代わりに、かけたまま光らせる）
    lens = "".join(f'<path d="M{x - 16} {EYE_Y - 9} L {x + 16} {EYE_Y - 9} L {x + 13} {EYE_Y + 6} Q {x} {EYE_Y + 12}, {x - 13} {EYE_Y + 6} Z" fill="#3D3550" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>' for x in (EYE_L, EYE_R))
    shine = "".join(f'<path d="M{x - 9} {EYE_Y - 4} l 6 -2" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/><path d="M{x - 9} {EYE_Y + 1} l 3 -1" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>' for x in (EYE_L, EYE_R))
    return lens + ink(f"M{EYE_L + 16} {EYE_Y - 7} L {EYE_R - 16} {EYE_Y - 7}", 3.6) + shine


def face_sweat():  # 汗のしずく（こめかみ）
    return f'<path d="M62 78 q 7 10 0 15 q -7 -5 0 -15 z" fill="#9FD8FF" stroke="{LINE}" stroke-width="2.4"/>'


def face_sparkles():  # 顔のまわりのきらきら
    return "".join(f'<path d="M{x} {y - r} Q {x} {y}, {x + r} {y} Q {x} {y}, {x} {y + r} Q {x} {y}, {x - r} {y} Q {x} {y}, {x} {y - r} Z" fill="#FFFFFF" stroke="{LINE}" stroke-width="2"/>'
                   for x, y, r in [(30, 78, 9), (212, 116, 8), (26, 124, 6)])


def face_vein():  # 気合いのマーク（四つ角の怒りマーク）
    x, y = 66, 76
    return "".join(ink(f"M{x + sx * 2} {y + sy * 8} Q {x + sx * 2} {y + sy * 2}, {x + sx * 8} {y + sy * 2}", 3.2)
                   for sx, sy in [(-1, -1), (1, -1), (-1, 1), (1, 1)])


def face_deco(names):
    return "".join(globals()[f"face_{n}"]() for n in names)


# ---------- タイプごとのかぶりもの・アクセサリー ----------
# 土台（BASE）だけが星のヘアピンとリボンをつける。16 タイプはそれぞれに合ったものをつける

def _bez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3))


_HEAD_TOP = [_bez((42, 104), (42, 72), (68, 38), (120, 38), i / 200) for i in range(201)] + \
    [_bez((120, 38), (172, 38), (198, 72), (198, 104), i / 200) for i in range(201)]


def head_y(x):
    """頭の上のふちの y（x のところ）"""
    return min(_HEAD_TOP, key=lambda p: abs(p[0] - x))[1]


def head_band(y_mid, thick, fill, x0=50, x1=190, extra=""):
    """頭の上のふちに沿った帯（はちまき・バンダナの下の線などに使う）"""
    xs = range(x0, x1 + 1, 5)
    top = [(x, head_y(x) + y_mid) for x in xs]
    pts = " L ".join(f"{x} {y:.1f}" for x, y in top)
    back = " L ".join(f"{x} {y + thick:.1f}" for x, y in reversed(top))
    return f'<path d="M{pts} L {back} Z" fill="{fill}" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"{extra}/>'


def acc_tophat():  # INTJ：小さなシルクハット（軍師）
    return ('<g transform="rotate(-12 132 40)">'
            f'<rect x="114" y="6" width="36" height="34" rx="4" fill="#4A3F63" stroke="{LINE}" stroke-width="3.4"/>'
            f'<rect x="114" y="28" width="36" height="7" fill="#B69CFF" stroke="{LINE}" stroke-width="2.6"/>'
            f'<ellipse cx="132" cy="41" rx="28" ry="6.5" fill="#4A3F63" stroke="{LINE}" stroke-width="3.4"/>'
            '<path d="M119 12 L 119 24" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.5"/></g>')


def acc_mortarboard():  # INTP：学者の角帽
    return (f'<path d="M92 34 L 92 46 Q 120 54, 148 46 L 148 34 Z" fill="#3E4A6B" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            f'<path d="M120 12 L 170 26 L 120 40 L 70 26 Z" fill="#4E5B80" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            + ink("M120 26 Q 150 28, 160 34 L 160 50", 2.6)
            + f'<path d="M156 48 L 164 48 L 166 60 L 154 60 Z" fill="#FFD84D" stroke="{LINE}" stroke-width="2.4" stroke-linejoin="round"/>'
            f'<circle cx="120" cy="26" r="3.4" fill="#FFD84D" stroke="{LINE}" stroke-width="2.2"/>')


def acc_crown():  # ENTJ：王冠
    pts = "84,48 84,22 98,34 110,12 120,30 130,12 142,34 156,22 156,48"
    jewels = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}" stroke="{LINE}" stroke-width="2"/>'
                     for x, y, r, col in [(110, 12, 3.6, "#FF8597"), (130, 12, 3.6, "#7FC8FF"), (84, 22, 3, "#B6E8A0"), (156, 22, 3, "#B6E8A0"), (120, 40, 4.4, "#FF8597")])
    return (f'<polygon points="{pts}" fill="#FFD84D" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            '<path d="M90 30 L 92 42" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.7"/>' + jewels)


def acc_goggles():  # ENTP：おでこのゴーグル（発明家）
    out = head_band(14, 9, "#8C6A55", 46, 194)
    for x in (100, 140):
        y = head_y(x) + 14
        out += (f'<circle cx="{x}" cy="{y:.1f}" r="15" fill="#C9CED8" stroke="{LINE}" stroke-width="3.4"/>'
                f'<circle cx="{x}" cy="{y:.1f}" r="10" fill="#A8E4FF" stroke="{LINE}" stroke-width="2.6"/>'
                f'<path d="M{x - 5} {y - 3:.1f} q 2 -4 6 -4" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round"/>')
    return out


def acc_crescent():  # INFJ：宝石のサークレットと三日月の髪かざり（神秘）
    (x1, y1, r1), (x2, y2, r2) = (160, 44, 16), (167, 37, 13)
    # 2 つの円の交点を求め、外の円の大きい弧と内の円の弧で三日月を作る
    d = math.hypot(x2 - x1, y2 - y1)
    a = (r1 ** 2 - r2 ** 2 + d ** 2) / (2 * d)
    h = math.sqrt(r1 ** 2 - a ** 2)
    mx, my = x1 + a * (x2 - x1) / d, y1 + a * (y2 - y1) / d
    p1 = (mx + h * (y2 - y1) / d, my - h * (x2 - x1) / d)
    p2 = (mx - h * (y2 - y1) / d, my + h * (x2 - x1) / d)
    moon = (f'<path d="M{p1[0]:.1f} {p1[1]:.1f} A {r1} {r1} 0 1 1 {p2[0]:.1f} {p2[1]:.1f} A {r2} {r2} 0 1 0 {p1[0]:.1f} {p1[1]:.1f} Z" '
            f'fill="#FFE27A" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>')
    gy = head_y(120) + 24
    circlet = head_band(20, 4, "#FFD84D", 56, 184)
    gem = f'<path d="M120 {gy - 6:.1f} L 126 {gy + 2:.1f} L 120 {gy + 11:.1f} L 114 {gy + 2:.1f} Z" fill="#CDB8FF" stroke="{LINE}" stroke-width="2.6" stroke-linejoin="round"/>'
    return circlet + gem + moon + twinkle(188, 26, 6) + twinkle(132, 22, 4)


def acc_flowercrown():  # INFP：花かんむり
    out = ""
    leaves = [(80, -30), (104, -10), (136, 10), (160, 30)]
    for x, rot in leaves:
        y = head_y(x) + 2
        out += f'<ellipse cx="{x}" cy="{y:.1f}" rx="8" ry="4.5" transform="rotate({rot} {x} {y:.1f})" fill="#9BDDB8" stroke="{LINE}" stroke-width="2.4"/>'
    for x, col in [(68, "#FFFFFF"), (92, "#FFD84D"), (120, "#FF9DBA"), (148, "#FFFFFF"), (172, "#CDB8FF")]:
        y = head_y(x) + 1
        out += "".join(f'<circle cx="{x + 6 * math.cos(math.radians(a)):.1f}" cy="{y + 6 * math.sin(math.radians(a)):.1f}" r="5" fill="{col}" stroke="{LINE}" stroke-width="2.2"/>'
                       for a in range(-90, 270, 72))
        out += f'<circle cx="{x}" cy="{y:.1f}" r="3.6" fill="#FFB347" stroke="{LINE}" stroke-width="2"/>'
    return out


def acc_hachimaki():  # ENFJ：推し活のはちまき（ハートつき）
    out = head_band(16, 11, "#FFFFFF", 44, 196)
    y = head_y(120) + 21.5
    out += f'<path {heart_path(120, y, 10)} fill="#FF5E8A" stroke="{LINE}" stroke-width="{2.2 / (10 / 12):.2f}"/>'
    ky = head_y(190) + 20
    out += (f'<path d="M192 {ky:.1f} q 14 -10 20 -2 q -8 6 -20 2 z" fill="#FFFFFF" stroke="{LINE}" stroke-width="2.8" stroke-linejoin="round"/>'
            f'<path d="M192 {ky:.1f} q 12 6 16 16 q -10 -2 -16 -16 z" fill="#FFFFFF" stroke="{LINE}" stroke-width="2.8" stroke-linejoin="round"/>')
    return out


def acc_partyhat():  # ENFP：パーティー帽
    return ('<g transform="rotate(14 126 44)">'
            f'<path d="M106 48 L 126 8 L 146 48 Z" fill="#9FD8FF" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            f'<path d="M112 30 L 140 30 L 136 22 L 116 22 Z" fill="#FF9DBA"/>'
            f'<path d="M108 40 L 144 40" stroke="#FFD84D" stroke-width="5"/>'
            f'<path d="M106 48 L 126 8 L 146 48 Z" fill="none" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            f'<circle cx="126" cy="8" r="6" fill="#FFD84D" stroke="{LINE}" stroke-width="2.8"/></g>')


def acc_officialcap():  # ISTJ：つばのある制帽（委員長・駅員）
    return (f'<path d="M80 48 C 78 30, 86 18, 120 18 C 154 18, 162 30, 160 48 Z" fill="#3E4A6B" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            f'<rect x="80" y="38" width="80" height="9" fill="#2E3650" stroke="{LINE}" stroke-width="2.6"/>'
            f'<path d="M84 47 Q 120 62, 156 47 Q 120 54, 84 47 Z" fill="#2E3650" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>'
            f'<circle cx="120" cy="30" r="5.5" fill="#FFD84D" stroke="{LINE}" stroke-width="2.4"/>')


def acc_nursecap():  # ISFJ：ナースキャップ（ハートの印）
    return (f'<path d="M86 48 L 92 22 Q 120 14, 148 22 L 154 48 Q 120 40, 86 48 Z" fill="#FFFFFF" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            + ink("M92 30 Q 120 23, 148 30", 2.2)
            + f'<path {heart_path(120, 34, 9)} fill="#FF8597" stroke="{LINE}" stroke-width="{2 / (9 / 12):.2f}"/>')


def acc_hardhat():  # ESTJ：現場監督のヘルメット
    return (f'<path d="M78 46 C 78 22, 96 12, 120 12 C 144 12, 162 22, 162 46 Z" fill="#FFD84D" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            f'<rect x="68" y="42" width="104" height="10" rx="5" fill="#FFC94D" stroke="{LINE}" stroke-width="3.4"/>'
            f'<path d="M112 13 L 112 42 M128 13 L 128 42" stroke="{LINE}" stroke-width="2.6"/>'
            '<path d="M92 24 Q 98 18, 104 16" stroke="#FFFFFF" stroke-width="3.4" fill="none" stroke-linecap="round"/>')


def acc_bowband():  # ESFJ：大きなリボンのカチューシャ（幹事）
    return head_band(4, 7, "#FF8597", 52, 188) + bow(150, 40, -14, 1.75, "#FF9DBA")


def acc_backcap():  # ISTP：後ろ向きのキャップ（職人）
    return (f'<path d="M150 30 L 186 26 Q 190 34, 182 38 L 154 40 Z" fill="#6B8F71" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>'
            f'<path d="M80 50 C 78 28, 96 16, 120 16 C 144 16, 162 28, 160 50 Q 120 44, 80 50 Z" fill="#8FB996" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            + ink("M120 16 L 120 46", 2.2)
            + f'<circle cx="120" cy="16" r="4" fill="#6B8F71" stroke="{LINE}" stroke-width="2.4"/>'
            f'<rect x="108" y="38" width="24" height="8" rx="3" fill="#F2EDE4" stroke="{LINE}" stroke-width="2.2"/>')


def acc_beret():  # ISFP：画家のベレー帽
    return (f'<ellipse cx="124" cy="36" rx="46" ry="15" transform="rotate(-10 124 36)" fill="#E67A8A" stroke="{LINE}" stroke-width="3.4"/>'
            f'<path d="M126 22 q 2 -8 8 -9" stroke="{LINE}" stroke-width="4" fill="none" stroke-linecap="round"/>'
            '<path d="M96 34 Q 104 27, 116 25" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>')


def acc_bandana():  # ESTP：赤いバンダナ
    xs = list(range(48, 193, 4))
    top = " L ".join(f"{x} {head_y(x) - 1:.1f}" for x in xs)
    bottom = " L ".join(f"{x} {head_y(x) + 16 + 4 * abs(x - 120) / 72:.1f}" for x in reversed(xs))
    dots = "".join(f'<circle cx="{x}" cy="{head_y(x) + 8:.1f}" r="2.2" fill="#FFFFFF"/>' for x in (72, 96, 120, 144, 168))
    ky = head_y(190) + 14
    return (f'<path d="M{top} L {bottom} Z" fill="#F0605D" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>' + dots
            + f'<path d="M190 {ky:.1f} l 18 -8 l -2 12 z M190 {ky:.1f} l 14 12 l -12 4 z" fill="#F0605D" stroke="{LINE}" stroke-width="2.8" stroke-linejoin="round"/>')


def acc_catears():  # ESFP：ねこみみのカチューシャ（アイドル）
    out = head_band(2, 6, "#FFFFFF", 56, 184)
    for x, rot in ((86, -16), (154, 16)):
        y = head_y(x) + 6
        out += (f'<g transform="rotate({rot} {x} {y:.1f})">'
                f'<path d="M{x - 15} {y:.1f} L {x} {y - 28:.1f} L {x + 15} {y:.1f} Z" fill="#FFFFFF" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
                f'<path d="M{x - 7} {y - 3:.1f} L {x} {y - 17:.1f} L {x + 7} {y - 3:.1f} Z" fill="#FF9DBA"/></g>')
    return out


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
    # 分析：たくらむ半目・片眉・片方だけ上がる口
    "INTJ": dict(acc="tophat", eyes="half", brows="raised", mouth="smirk", cheeks="none", pose="raise_r", props=[("knight", 205, 82, 1.6)]),
    # 考えすぎてぐるぐる・汗
    "INTP": dict(acc="mortarboard", eyes="spiral", brows="worried", mouth="o", pose="chin", deco=["sweat"], props=[("question", 44, 50, 1.35)]),
    # ドヤ顔（目を閉じて、歯を見せて笑う）
    "ENTJ": dict(acc="crown", eyes="smug", brows="confident", mouth="teeth", pose="point", props=[("exclaim", 210, 68, 1.5)]),
    # ひらめいて星の目・大口
    "ENTP": dict(acc="goggles", eyes="star", brows="up", mouth="laugh", pose="raise_r", props=[("bulb", 206, 76, 1.5)]),
    # おだやかに目を閉じる・まわりにきらきら
    "INFJ": dict(acc="crescent", eyes="peace", brows="soft", mouth="smile", pose="hold", deco=["sparkles"], props=[("crystal", 120, 148, 1.3)]),
    # うるうるの大きな目・ふにゃっとした口・照れ
    "INFP": dict(acc="flowercrown", eyes="teary", brows="worried", mouth="wavy", cheeks="blush", pose="hold", props=[("flower", 120, 150, 1.35)]),
    # ハートの目・推しへの全力の笑顔
    "ENFJ": dict(acc="hachimaki", eyes="heart", mouth="grin", cheeks="heart", pose="raise_r", props=[("uchiwa", 206, 70, 1.4)]),
    # ＞＜ で大笑い
    "ENFP": dict(acc="partyhat", eyes="xx", mouth="laugh", cheeks="heart", pose="banzai", props=[("confetti",)]),
    # めがね・まっすぐの眉と口
    "ISTJ": dict(acc="officialcap", eyes="dot", brows="flat", mouth="flat", cheeks="none", pose="hold", deco=["glasses"], props=[("clipboard", 120, 150, 1.25)]),
    # にっこり ∩ の目・ω の口
    "ISFJ": dict(acc="nursecap", eyes="happy", brows="soft", mouth="cat", cheeks="heart", pose="hold", props=[("bandage", 120, 141, 1.4)]),
    # 吊り目で号令・気合いのマーク
    "ESTJ": dict(acc="hardhat", eyes="determined", brows="confident", mouth="shout", pose="raise_r", deco=["vein"], props=[("flag", 202, 80, 1.4)]),
    # きらきらの目・開けた笑顔
    "ESFJ": dict(acc="bowband", eyes="sparkle", brows="up", mouth="grin", cheeks="heart", pose="hold", props=[("camera", 120, 150, 1.25)]),
    # ジト目・無表情
    "ISTP": dict(acc="backcap", eyes="jito", mouth="flat", cheeks="none", pose="hold", props=[("wrench", 124, 156, 1.4)]),
    # うっとり上を見る・照れ
    "ISFP": dict(acc="beret", eyes="dreamy", brows="soft", mouth="smile", cheeks="blush", pose="hold", props=[("brush", 124, 148, 1.4), ("paint",)]),
    # サングラスで歯を見せてニッ
    "ESTP": dict(acc="bandana", eyes="dot", brows="confident", mouth="teeth", cheeks="none", pose="fist", deco=["sunglasses"], props=[("motion",)]),
    # ウインクで舌を出す
    "ESFP": dict(acc="catears", eyes="wink", brows="up", mouth="tongue", cheeks="heart", pose="mic", props=[("mic", 152, 136, 1.45), ("notes",)]),
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
    """code に合った表情・ポーズ・持ち物・かぶりもので描く。code が 16 タイプにないときは土台（手を振る・点の目・ちゅの口・星のヘアピン）"""
    t = TYPES.get(code, dict(eyes="base", mouth="chu", pose="wave", props=[]))
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
  <path d="M72 76 Q 80 60, 96 52" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  {globals()[f"acc_{t['acc']}"]() if "acc" in t else hairpin()}
  {cheeks(t.get("cheeks", "oval"), c)}
  {brows(t.get("brows", ""))}
  {eyes(t["eyes"], c)}
  {mouth(t["mouth"], c)}
  {face_deco(t.get("deco", []))}
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
