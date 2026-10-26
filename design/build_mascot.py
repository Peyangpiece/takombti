"""たこ診のマスコット（土台）を SVG で組み立てる。
サンリオのキャラクターに共通する描き方の特徴（平らなパステルの塗り・太さが一定の焦げ茶の線・
大きな丸い頭と小さな体・小さな点の目）を取り入れた、自前のキャラクター。"""
import math
import sys

LINE = "#5A3A3A"
W = 4.5  # 線の太さ（どこも同じ）
BASE = {
    "body": "#FFB8C6", "spot": "#FF9DB2", "blush": "#FF8FA8",
    "mouth": "#FF7E9B", "eye": LINE, "sucker": "#FFE4EA",  # 目は線画と同じ色
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


def eye_teary(x, c):  # うるうる：目の下のほうに涙がたまり、光が多く映る
    rx, ry, cy = 10.9, 13.8, EYE_Y - 1
    wy = cy + 5.5  # たまった涙の上のふち
    hw = rx * math.sqrt(1 - ((wy - cy) / ry) ** 2)
    pool = (f'<path d="M{x - hw:.1f} {wy:.1f} Q {x - hw / 2:.1f} {wy + 2.5:.1f}, {x:.1f} {wy:.1f} T {x + hw:.1f} {wy:.1f} '
            f'A {rx} {ry} 0 0 1 {x - hw:.1f} {wy:.1f} Z" fill="#8FD0FF" opacity="0.9"/>')
    return (f'<ellipse cx="{x}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{c["eye"]}"/>' + pool
            + f'<circle cx="{x + 3.4}" cy="{cy - 5.5}" r="4.4" fill="#FFFFFF"/>'
            f'<circle cx="{x - 4}" cy="{cy - 1}" r="2" fill="#FFFFFF"/>'
            f'<path d="M{x - 5} {wy + 4.5:.1f} Q {x} {wy + 6.5:.1f}, {x + 5} {wy + 4.5:.1f}" stroke="#FFFFFF" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.9"/>')


def tear_drop(px, py, k=1.0):
    """目じりからこぼれる涙のしずく。とがった先を目じりに付け、下を丸くする"""
    r = 4.6 * k
    bx, by = px + 2.5 * k, py + 11 * k  # 丸い部分の中心
    d = (f"M{px} {py} C {px + 1.5 * k} {py + 4 * k}, {bx + r} {by - 4 * k}, {bx + r} {by} "
         f"A {r} {r} 0 0 1 {bx - r} {by} C {bx - r} {by - 3.5 * k}, {px - 1 * k} {py + 4 * k}, {px} {py} Z")
    return (f'<path d="{d}" fill="#8FD0FF" stroke="{LINE}" stroke-width="2.2" stroke-linejoin="round"/>'
            f'<circle cx="{bx - 1.6 * k:.1f}" cy="{by - 0.6 * k:.1f}" r="{1.4 * k:.1f}" fill="#FFFFFF"/>')


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


def eye_determined(x, c, toward):  # 吊り目（丸い目の上を、鼻の側へ下がる斜めのまぶたで切る）。toward は鼻の向き（+1 / -1）
    inner, outer = x + 10 * toward, x - 10 * toward
    lid = (f'<path d="M{outer} {EYE_Y - 14} L {outer} {EYE_Y - 6} L {inner} {EYE_Y - 1} L {inner} {EYE_Y - 14} Z" '
           f'fill="{c["body"]}"/>')
    return (f'<ellipse cx="{x}" cy="{EYE_Y + 1}" rx="7.5" ry="9" fill="{c["eye"]}"/>'
            + lid
            + ink(f"M{outer} {EYE_Y - 6} L {inner} {EYE_Y - 1}", 3.6)
            + f'<circle cx="{x + 2.5 * toward}" cy="{EYE_Y + 2}" r="2.2" fill="#FFFFFF"/>')


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
    return (f'<polygon points="{pts}" fill="{c["eye"]}" stroke="{c["eye"]}" stroke-width="2.4" stroke-linejoin="round"/>'
            f'<circle cx="{x + 2.6}" cy="{EYE_Y - 2.6}" r="2" fill="#FFFFFF"/>')


def eye_heart(x, c):  # ハートの目
    return (f'<path {heart_path(x, EYE_Y + 1, 13)} fill="{c["eye"]}"/>'
            f'<circle cx="{x + 4}" cy="{EYE_Y - 3.5}" r="2.2" fill="#FFFFFF"/>')


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
        return eye_teary(EYE_L, c) + eye_teary(EYE_R, c) + tear_drop(EYE_R + 7.5, EYE_Y + 9, 0.9)
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
    rims = "".join(f'<rect x="{x - 14}" y="{EYE_Y - 12}" width="28" height="24" rx="7" fill="none" stroke="{LINE}" stroke-width="3.6"/>' for x in (EYE_L, EYE_R))
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


# ---------- 頭のつや ----------
# 光はどのキャラも左上から当たるものとし、つやは頭のふちと平行な弧で描く。
# かぶりものや帯にかくれる所には置けないので、キャラごとに弧の位置（角度）と、ふちからの距離を変える。
# 角度は頭を楕円（中心 120,104・横 78・縦 66）とみたときの値で、180 が左はし、270 がてっぺん。
SHINE_DEFAULT = (200, 236, 12)


def head_shine(a0, a1, inset, w=6):
    rx, ry = 78 - inset, 66 - inset
    pt = lambda a: (120 + rx * math.cos(math.radians(a)), 104 + ry * math.sin(math.radians(a)))
    (x0, y0), (x1, y1) = pt(a0), pt(a1)
    dx, dy = pt(a1 + 9)  # 弧の先に、小さな点をひとつ
    return (f'<path d="M{x0:.1f} {y0:.1f} A {rx} {ry} 0 0 1 {x1:.1f} {y1:.1f}" fill="none" stroke="#FFFFFF" stroke-width="{w}" stroke-linecap="round" opacity="0.92"/>'
            f'<circle cx="{dx:.1f}" cy="{dy:.1f}" r="{w * 0.42:.1f}" fill="#FFFFFF" opacity="0.92"/>')


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


def acc_tophat():  # INTJ：小さなシルクハット（軍師）。頭のまん中に、右へ少し傾けてかぶる
    return ('<g transform="rotate(9 126 44)">'
            f'<rect x="108" y="8" width="36" height="34" rx="4" fill="#4A3F63" stroke="{LINE}" stroke-width="3.4"/>'
            f'<rect x="108" y="30" width="36" height="7" fill="#B69CFF" stroke="{LINE}" stroke-width="2.6"/>'
            f'<ellipse cx="126" cy="43" rx="30" ry="6.5" fill="#4A3F63" stroke="{LINE}" stroke-width="3.4"/>'
            '<path d="M114 14 L 114 26" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.5"/></g>')


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
    (x1, y1, r1), (x2, y2, r2) = (166, 58, 15), (159, 51, 12)  # 内の円を左上にずらし、欠けを左上にする
    # 2 つの円の交点を求め、外の円の大きい弧と内の円の弧で三日月を作る
    d = math.hypot(x2 - x1, y2 - y1)
    a = (r1 ** 2 - r2 ** 2 + d ** 2) / (2 * d)
    h = math.sqrt(r1 ** 2 - a ** 2)
    mx, my = x1 + a * (x2 - x1) / d, y1 + a * (y2 - y1) / d
    p1 = (mx + h * (y2 - y1) / d, my - h * (x2 - x1) / d)
    p2 = (mx - h * (y2 - y1) / d, my + h * (x2 - x1) / d)
    moon = (f'<path d="M{p1[0]:.1f} {p1[1]:.1f} A {r1} {r1} 0 1 0 {p2[0]:.1f} {p2[1]:.1f} A {r2} {r2} 0 0 1 {p1[0]:.1f} {p1[1]:.1f} Z" '
            f'fill="#FFE27A" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>')
    gy = head_y(120) + 24
    circlet = head_band(20, 4, "#FFD84D", 56, 184)
    gem = f'<path d="M120 {gy - 6:.1f} L 126 {gy + 2:.1f} L 120 {gy + 11:.1f} L 114 {gy + 2:.1f} Z" fill="#CDB8FF" stroke="{LINE}" stroke-width="2.6" stroke-linejoin="round"/>'
    return circlet + gem + moon + twinkle(190, 34, 6) + twinkle(142, 30, 4)


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
    """おでこに巻いた白い布。頭を回りこむので、まん中が少し下がる弧にし、頭の形で切り抜く（両はしは輪郭にぴったり重なる）。
    結び目は左の横（右手はうちわを持つので）。布の端が 2 本、外へなびく"""
    top, bot = "M0 44 Q 120 90, 240 44", "M240 57 Q 120 103, 0 57"
    band = (f'<g clip-path="__HEAD_CLIP__"><path d="{top} L {bot[1:]} Z" fill="#FFFFFF"/>'
            f'<path d="{top}" fill="none" stroke="{LINE}" stroke-width="3.4"/><path d="{bot}" fill="none" stroke="{LINE}" stroke-width="3.4"/></g>'
            f'<path d="{HEAD}" fill="none" stroke="{LINE}" stroke-width="{W}"/>')
    tails = (f'<path d="M50 62 C 42 58, 32 58, 26 62 C 32 66, 42 67, 50 66 Z" fill="#FFFFFF" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
             f'<path d="M50 66 C 43 70, 38 77, 37 84 C 43 81, 49 75, 52 69 Z" fill="#FFFFFF" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>')
    knot = f'<ellipse cx="50" cy="64.5" rx="5" ry="6" fill="#FFFFFF" stroke="{LINE}" stroke-width="3"/>'
    heart = f'<path {heart_path(120, 71, 9)} fill="#FF5E8A" stroke="{LINE}" stroke-width="{2.2 / (9 / 12):.2f}"/>'
    return tails + band + knot + heart


def acc_partyhat():  # ENFP：パーティー帽。底を頭の丸みに沿わせて少しめり込ませ、下に薄い影を付ける
    apex = (140, 6)  # 先を右へ少し傾ける
    xs = list(range(108, 155, 3))
    base = [(x, head_y(x) + 6) for x in xs]  # 頭のふちより少し下＝かぶっている
    (lx, ly), (rx, ry) = base[0], base[-1]

    def edge(t, side):  # 先（t=0）から底の角（t=1）までの、左右の辺の上の点
        bx, by = (lx, ly) if side == "l" else (rx, ry)
        return (apex[0] + (bx - apex[0]) * t, apex[1] + (by - apex[1]) * t)

    def band(t1, t2, fill):  # 2 つの高さのあいだの帯
        a, b, c, d = edge(t1, "l"), edge(t1, "r"), edge(t2, "r"), edge(t2, "l")
        return (f'<path d="M{a[0]:.1f} {a[1]:.1f} L {b[0]:.1f} {b[1]:.1f} L {c[0]:.1f} {c[1]:.1f} '
                f'L {d[0]:.1f} {d[1]:.1f} Z" fill="{fill}"/>')

    bottom = " L ".join(f"{x} {y:.1f}" for x, y in reversed(base))
    cone = f"M{apex[0]} {apex[1]} L {rx} {ry:.1f} L {bottom} Z"
    shadow = " L ".join(f"{x} {y + 4:.1f}" for x, y in base)
    return (f'<path d="M{shadow}" stroke="{LINE}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.12"/>'
            f'<path d="{cone}" fill="#9FD8FF"/>'
            + band(0.32, 0.5, "#FF9DBA") + band(0.68, 0.84, "#FFD84D")
            + f'<path d="{cone}" fill="none" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            + f'<circle cx="{apex[0]}" cy="{apex[1]}" r="6" fill="#FFD84D" stroke="{LINE}" stroke-width="2.8"/>')


def acc_officialcap():  # ISTJ：つばのある制帽（委員長・駅員）。上が少し広がった形に、前へ出たつば
    top = (f'<path d="M84 44 L 76 26 Q 120 10, 164 26 L 156 44 Z" fill="#3E4A6B" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>')
    band = f'<path d="M84 44 L 156 44 L 157 52 L 83 52 Z" fill="#2E3650" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
    visor = f'<path d="M82 51 Q 120 47, 158 51 Q 150 64, 120 64 Q 90 64, 82 51 Z" fill="#232A40" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>'
    badge = f'<circle cx="120" cy="32" r="5.5" fill="#FFD84D" stroke="{LINE}" stroke-width="2.4"/>'
    shine = '<path d="M90 27 Q 100 22, 112 20" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>'
    return top + band + visor + badge + shine


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


def acc_beanie():  # ISTP：ニット帽（職人）。深めにかぶり、折り返しとうね模様
    dome = (f'<path d="M76 56 C 74 30, 96 16, 120 16 C 144 16, 166 30, 164 56 Z" fill="#7E9C82" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>')
    ribs = "".join(ink(f"M{x} {24 + abs(x - 120) * 0.25:.1f} L {x} 48", 2) for x in (98, 109, 120, 131, 142))
    cuff = f'<path d="M72 50 Q 120 40, 168 50 L 168 60 Q 120 50, 72 60 Z" fill="#6B8F71" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
    return dome + ribs + cuff


def acc_beret():  # ISFP：画家のベレー帽。平たくふっくらした形を右へ傾け、右側を頭のふちの外へ垂らす。かぶり口に影
    return ('<g transform="rotate(6 130 40)">'
            f'<path d="M80 54 C 74 22, 100 12, 130 12 C 200 12, 212 36, 204 50 C 200 56, 182 64, 176 62 Q 128 62, 80 54 Z" '
            f'fill="#E67A8A" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>'
            '<path d="M83 51 Q 128 55, 174 58 Q 128 61, 83 51 Z" fill="#C9586B"/>'
            f'<path d="M122 12 q 1 -8 8 -10" stroke="{LINE}" stroke-width="4" fill="none" stroke-linecap="round"/>'
            '<path d="M90 32 Q 102 22, 120 20" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/></g>')


def acc_bandana():  # ESTP：赤いバンダナ
    xs = list(range(48, 193, 4))
    top = " L ".join(f"{x} {head_y(x) - 1:.1f}" for x in xs)
    bottom = " L ".join(f"{x} {head_y(x) + 16 + 4 * abs(x - 120) / 72:.1f}" for x in reversed(xs))
    dots = "".join(f'<circle cx="{x}" cy="{head_y(x) + 8:.1f}" r="2.2" fill="#FFFFFF"/>' for x in (72, 96, 120, 144, 168))
    ky = head_y(190) + 14
    return (f'<path d="M{top} L {bottom} Z" fill="#F0605D" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/>' + dots
            + f'<path d="M190 {ky:.1f} l 18 -8 l -2 12 z M190 {ky:.1f} l 14 12 l -12 4 z" fill="#F0605D" stroke="{LINE}" stroke-width="2.8" stroke-linejoin="round"/>')


def acc_catears():  # ESFP：ねこみみのカチューシャ（アイドル）
    """帯はてっぺんより少し前に、頭を横切る弧としてかける（上に後頭部が少し見える）。弧は頭の形で切り抜くので、両はしは輪郭にぴったり重なる。
    帯は奥（横）ほど細く見えるよう、上のふちと下のふちで弧の高さを変える。
    耳は丸みのある三角で、先を少し丸め、根もとを帯の傾きにそろえる。耳と帯は 1 つの形として描く
    （耳の輪郭を先に太く描き、帯のあとで耳を白く塗る）ので、耳と帯のあいだに線が出ない"""
    ear = "M-15 1 C -14 -8, -8.5 -18, -2 -25 Q 1 -28, 4 -25 C 9.5 -17, 14 -8, 15 1 Z"
    inner = "M-8 -2 C -7.5 -7, -4.5 -13, -0.5 -17.5 Q 1 -19, 2.5 -17.5 C 6 -12, 8 -7, 8 -2 Q 0 0.5, -8 -2 Z"
    top_ry, bot_ry = 56, 47
    ys = lambda x, ry: 104 - ry * math.sqrt(1 - ((x - 120) / 82) ** 2)
    ears = []
    for x in (88, 152):
        slope = math.degrees(math.atan(top_ry * (x - 120) / (82 ** 2 * math.sqrt(1 - ((x - 120) / 82) ** 2))))
        ears.append((x, (ys(x, top_ry) + ys(x, bot_ry)) / 2 + 0.5, slope))
    g = lambda x, y, rot, body: f'<g transform="translate({x} {y:.1f}) rotate({rot:.1f})">{body}</g>'
    band = f"M38 104 A 82 {top_ry} 0 0 1 202 104 A 82 {bot_ry} 0 0 0 38 104 Z"
    return ("".join(g(x, y, r, f'<path d="{ear}" fill="{LINE}" stroke="{LINE}" stroke-width="6.8" stroke-linejoin="round"/>') for x, y, r in ears)
            + f'<g clip-path="__HEAD_CLIP__"><path d="{band}" fill="#FFFFFF" stroke="{LINE}" stroke-width="3.4" stroke-linejoin="round"/></g>'
            f'<path d="{HEAD}" fill="none" stroke="{LINE}" stroke-width="{W}"/>'
            + "".join(g(x, y, r, f'<path d="{ear}" fill="#FFFFFF"/><path d="{inner}" fill="#FF9DBA"/>'
                        '<path d="M-8.5 -7 Q -6.5 -13, -3.5 -16.5" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.9"/>')
                      for x, y, r in ears))


# ---------- ポーズ（腕） ----------
# back は頭の後ろ、front は頭と持ち物の手前に描く
POSES = {
    "wave": {"back": ["M60 130 C 44 128, 35 118, 34 104", "M182 142 C 196 148, 206 146, 210 138"]},
    "banzai": {"back": ["M58 130 C 40 124, 28 108, 26 90", "M182 130 C 200 124, 212 108, 214 90"]},
    # 両腕を体の前に回して、まん中で持ち物を抱える（I の手の自然な形）
    "hold": {"front": ["M72 136 C 72 150, 80 158, 92 157", "M168 136 C 168 150, 160 158, 148 157"]},
    # 右手を上げて持ち物をかかげる。腕は体の手前に出し、丸い手で持ち手をにぎる
    "raise_r": {"back": ["M58 140 C 46 148, 38 148, 34 140"], "front": ["M174 128 C 192 126, 204 112, 206 94"]},
    "point": {"back": ["M58 140 C 46 148, 38 148, 34 140", "M182 126 C 198 120, 210 112, 220 104"]},
    "chin": {"back": ["M182 142 C 194 150, 204 150, 208 142"], "front": ["M74 136 C 76 148, 88 152, 101 146"]},
    "fist": {"back": ["M58 140 C 46 148, 38 148, 34 140", "M182 130 C 198 128, 206 118, 202 102"]},
    "mic": {"back": ["M58 132 C 44 126, 36 116, 36 104"], "front": ["M171 135 C 171 146, 163 152, 152 150"]},
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


def prop_mic(x, y):  # アイドルのマイク：頭を口のわきへ。持ち手はまっすぐ下へのび、手の中を通って下に少し出る
    """頭は網目の入った丸、首にピンクの輪、持ち手は白。つやは頭の左上に小さく入れる（ふちに付けない）"""
    return (f'<g transform="rotate(-10 {x} {y})">'
            f'<path d="M{x} {y + 4} L {x} {y + 26}" stroke="{LINE}" stroke-width="9.6" stroke-linecap="round"/>'
            f'<path d="M{x} {y + 4} L {x} {y + 26}" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>'
            f'<path d="M{x} {y + 5} L {x} {y + 7}" stroke="{LINE}" stroke-width="11" stroke-linecap="round"/>'
            f'<path d="M{x} {y + 5} L {x} {y + 7}" stroke="#FF9DBA" stroke-width="7.4" stroke-linecap="round"/></g>'
            f'<circle cx="{x}" cy="{y - 3}" r="7.2" fill="#D5DAE3" stroke="{LINE}" stroke-width="2.6"/>'
            f'<path d="M{x - 4.6} {y - 5.6} Q {x} {y - 3.6}, {x + 4.6} {y - 5.6} M{x - 4.6} {y - 0.6} Q {x} {y + 1.4}, {x + 4.6} {y - 0.6}" '
            f'stroke="#A9B1C2" stroke-width="1.1" fill="none" stroke-linecap="round"/>'
            f'<ellipse cx="{x - 2.6}" cy="{y - 6.2}" rx="2.2" ry="1.3" transform="rotate(-30 {x - 2.6} {y - 6.2})" fill="#FFFFFF" opacity="0.9"/>')


def prop_notes():  # 音符：♪ と ♫。玉は少し傾けた楕円、旗はやわらかく曲げる
    def head(x, y, s):
        return f'<ellipse cx="{x}" cy="{y}" rx="{4.6 * s:.1f}" ry="{3.4 * s:.1f}" fill="{LINE}" transform="rotate(-22 {x} {y})"/>'

    def eighth(x, y, s):  # ♪
        sx = x + 3.8 * s
        flag = (f'<path d="M{sx:.1f} {y - 16 * s:.1f} Q {sx + 8.5 * s:.1f} {y - 11.5 * s:.1f}, {sx + 5.5 * s:.1f} {y - 5 * s:.1f}" '
                f'stroke="{LINE}" stroke-width="{2.6:.1f}" fill="none" stroke-linecap="round"/>')
        return ink(f"M{sx:.1f} {y - 1 * s:.1f} L {sx:.1f} {y - 16 * s:.1f}", 2.6) + flag + head(x, y, s)

    def beamed(x, y, s):  # ♫
        x2, y2 = x + 12 * s, y - 3 * s
        s1, s2 = x + 3.8 * s, x2 + 3.8 * s
        beam = (f'<path d="M{s1:.1f} {y - 15 * s:.1f} L {s2:.1f} {y2 - 15 * s:.1f} L {s2:.1f} {y2 - 11 * s:.1f} L {s1:.1f} {y - 11 * s:.1f} Z" '
                f'fill="{LINE}" stroke="{LINE}" stroke-width="1.2" stroke-linejoin="round"/>')
        return (ink(f"M{s1:.1f} {y - 1 * s:.1f} L {s1:.1f} {y - 14 * s:.1f}", 2.6)
                + ink(f"M{s2:.1f} {y2 - 1 * s:.1f} L {s2:.1f} {y2 - 14 * s:.1f}", 2.6)
                + beam + head(x, y, s) + head(x2, y2, s))
    return beamed(198, 62, 1.0) + eighth(214, 100, 1.0)


def prop_exclaim(x, y):
    return ink(f"M{x} {y - 8} L {x} {y + 2}", 4) + f'<circle cx="{x}" cy="{y + 8}" r="2.4" fill="{LINE}"/>' + ink(f"M{x + 10} {y - 4} L {x + 14} {y - 9}", 3) + ink(f"M{x - 10} {y - 4} L {x - 14} {y - 9}", 3)


# ---------- 両手で抱える持ち物（サンリオのキャラクターの持ち物にならい、丸く単純な形・太さのそろった線） ----------
# 持ち物は 1.25 倍にして描く（上のはし y = 130 を基準）。「抱える」ポーズの手は (92, 157) と (148, 157) で、
# 大きくした持ち物の両はしに重なる。
# 口をかくさないよう、ここで描く上のはしは y ≈ 130 にそろえる
PW = 3.4  # 持ち物の線の太さ


def held_crystal(c):  # INFJ：台に乗った水晶玉
    return (f'<path d="M104 156 L 136 156 Q 142 156, 142 162 L 142 166 Q 142 170, 138 170 L 102 170 Q 98 170, 98 166 L 98 162 Q 98 156, 104 156 Z" fill="#B69CFF" stroke="{LINE}" stroke-width="{PW}" stroke-linejoin="round"/>'
            f'<circle cx="120" cy="145" r="14" fill="#E3D8FF" stroke="{LINE}" stroke-width="{PW}"/>'
            '<path d="M111 140 Q 113 134, 119 133" stroke="#FFFFFF" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
            '<path d="M125 146 l 1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2 z" fill="#FFFFFF"/>')


def held_bouquet(c):  # INFP：紙で包んだ小さな花束
    flowers = ""
    for fx, fy, col in [(109, 142, "#FFFFFF"), (131, 142, "#CDB8FF"), (120, 137, "#FF9DBA")]:
        flowers += "".join(f'<circle cx="{fx + 5 * math.cos(math.radians(a)):.1f}" cy="{fy + 5 * math.sin(math.radians(a)):.1f}" r="4.4" fill="{col}" stroke="{LINE}" stroke-width="2.4"/>'
                           for a in range(-90, 270, 72))
        flowers += f'<circle cx="{fx}" cy="{fy}" r="3" fill="#FFD84D" stroke="{LINE}" stroke-width="2"/>'
    leaves = (f'<ellipse cx="102" cy="148" rx="7" ry="4" transform="rotate(-30 102 148)" fill="#9BDDB8" stroke="{LINE}" stroke-width="2.4"/>'
              f'<ellipse cx="138" cy="148" rx="7" ry="4" transform="rotate(30 138 148)" fill="#9BDDB8" stroke="{LINE}" stroke-width="2.4"/>')
    wrap = f'<path d="M97 148 L 143 148 L 124 174 Q 120 178, 116 174 Z" fill="#FFF6E6" stroke="{LINE}" stroke-width="{PW}" stroke-linejoin="round"/>'
    return leaves + flowers + wrap + bow(120, 160, 0, 0.55, "#FF9DBA")


def held_clipboard(c):  # ISTJ：チェックリストの板
    return (f'<rect x="102" y="134" width="36" height="36" rx="5" fill="#E9C58F" stroke="{LINE}" stroke-width="{PW}"/>'
            f'<rect x="107" y="140" width="26" height="25" rx="2.5" fill="#FFFFFF" stroke="{LINE}" stroke-width="2.4"/>'
            f'<rect x="112" y="130" width="16" height="7" rx="3" fill="#C9CED8" stroke="{LINE}" stroke-width="2.6"/>'
            + ink("M111 148 l 3 3 l 5 -6", 2.6) + ink("M123 148 L 129 148", 2.4)
            + ink("M111 158 l 3 3 l 5 -6", 2.6) + ink("M123 158 L 129 158", 2.4))


def held_bandage(c):  # ISFJ：大きな絆創膏
    dots = "".join(f'<circle cx="{x}" cy="{y}" r="1.2" fill="{LINE}" opacity="0.5"/>' for x, y in [(102, 148), (102, 154), (138, 148), (138, 154)])
    return (f'<rect x="90" y="140" width="60" height="22" rx="11" fill="#FFD9B8" stroke="{LINE}" stroke-width="{PW}"/>'
            f'<rect x="110" y="143" width="20" height="16" rx="3" fill="#FFF1E3" stroke="{LINE}" stroke-width="2.2"/>' + dots)


def held_camera(c):  # ESFJ：カメラ
    return (f'<rect x="108" y="135" width="13" height="8" rx="2.5" fill="#9AA7C7" stroke="{LINE}" stroke-width="2.8"/>'
            f'<rect x="97" y="140" width="46" height="28" rx="7" fill="#9AA7C7" stroke="{LINE}" stroke-width="{PW}"/>'
            f'<circle cx="120" cy="154" r="10" fill="#E8EEFF" stroke="{LINE}" stroke-width="{PW}"/>'
            f'<circle cx="120" cy="154" r="4.2" fill="{LINE}"/><circle cx="118.3" cy="152.3" r="1.4" fill="#FFFFFF"/>'
            f'<circle cx="135" cy="146" r="2.4" fill="#FFD84D" stroke="{LINE}" stroke-width="1.6"/>')


def held_toolbox(c):  # ISTP：工具箱
    return (ink("M110 143 L 110 137 Q 110 133, 114 133 L 126 133 Q 130 133, 130 137 L 130 143", PW)
            + f'<rect x="97" y="142" width="46" height="26" rx="5" fill="#E8705F" stroke="{LINE}" stroke-width="{PW}"/>'
            + ink("M97 151 L 143 151", 2.6)
            + f'<rect x="115" y="148" width="10" height="7" rx="2" fill="#FFD84D" stroke="{LINE}" stroke-width="2.2"/>')


def held_palette(c):  # ISFP：絵の具のパレット
    blob = ('M98 150 C 96 140, 108 136, 120 137 C 134 138, 146 142, 145 152 '
            'C 144 162, 132 166, 122 165 C 116 164, 116 158, 110 159 C 104 160, 99 158, 98 150 Z')
    dots = "".join(f'<circle cx="{x}" cy="{y}" r="3.6" fill="{col}" stroke="{LINE}" stroke-width="1.8"/>'
                   for x, y, col in [(107, 148, "#FF9DBA"), (116, 143, "#FFD84D"), (127, 143, "#7FC8FF"), (136, 148, "#9BDDB8")])
    return (f'<path d="{blob}" fill="#F3D7A8" stroke="{LINE}" stroke-width="{PW}" stroke-linejoin="round"/>'
            f'<circle cx="131" cy="157" r="3.4" fill="{c["body"]}" stroke="{LINE}" stroke-width="2"/>' + dots)


# ---------- 16 タイプの設定 ----------
# eyes / brows / mouth / cheeks / pose / props（(関数名, 引数) の並び）
TYPES = {
    # 分析：たくらむ半目・片眉・片方だけ上がる口
    "INTJ": dict(shine=(196, 230, 12), acc="tophat", eyes="half", brows="raised", mouth="smirk", cheeks="none", pose="raise_r", props=[], in_front=[("knight", 206, 71, 1.4)]),
    # 考えすぎてぐるぐる・汗
    "INTP": dict(shine=(188, 218, 12), acc="mortarboard", eyes="spiral", brows="worried", mouth="o", pose="chin", deco=["sweat"], props=[("question", 44, 50, 1.35)]),
    # ドヤ顔（目を閉じて、歯を見せて笑う）
    "ENTJ": dict(shine=(194, 228, 12), acc="crown", eyes="smug", brows="confident", mouth="teeth", pose="point", props=[("exclaim", 210, 68, 1.5)]),
    # ひらめいて星の目・大口
    "ENTP": dict(shine=(190, 222, 28), acc="goggles", eyes="star", brows="up", mouth="laugh", pose="raise_r", props=[], in_front=[("bulb", 206, 76, 1.4)]),
    # おだやかに目を閉じる・まわりにきらきら
    "INFJ": dict(shine=(192, 226, 24), acc="crescent", eyes="peace", brows="soft", mouth="smile", pose="hold", deco=["sparkles"], props=[("held_crystal",)]),
    # うるうるの大きな目・ふにゃっとした口・照れ
    "INFP": dict(shine=(194, 228, 22), acc="flowercrown", eyes="teary", brows="worried", mouth="wavy", cheeks="blush", pose="hold", props=[("held_bouquet",)]),
    # ハートの目・推しへの全力の笑顔
    "ENFJ": dict(shine=(194, 222, 34), acc="hachimaki", eyes="heart", mouth="grin", cheeks="heart", pose="raise_r", props=[], in_front=[("uchiwa", 206, 66, 1.35)]),
    # ＞＜ で大笑い
    "ENFP": dict(shine=(200, 238, 12), acc="partyhat", eyes="xx", mouth="laugh", cheeks="heart", pose="banzai", props=[("confetti",)]),
    # めがね・まっすぐの眉と口
    "ISTJ": dict(shine=(184, 210, 12), acc="officialcap", eyes="dot", brows="flat", mouth="flat", cheeks="none", pose="hold", deco=["glasses"], props=[("held_clipboard",)]),
    # にっこり ∩ の目・ω の口
    "ISFJ": dict(shine=(196, 226, 12), acc="nursecap", eyes="happy", brows="soft", mouth="cat", cheeks="heart", pose="hold", props=[("held_bandage",)],
                 hands=["M70 138 C 68 154, 74 164, 84 164", "M170 138 C 172 154, 166 164, 156 164"]),
    # 吊り目で号令・気合いのマーク
    "ESTJ": dict(shine=(184, 210, 12), acc="hardhat", eyes="determined", brows="confident", mouth="shout", pose="raise_r", deco=["vein"], props=[], in_front=[("flag", 206, 82, 1.2)]),
    # きらきらの目・開けた笑顔
    "ESFJ": dict(shine=(192, 228, 20), acc="bowband", eyes="sparkle", brows="up", mouth="grin", cheeks="heart", pose="hold", props=[("held_camera",)]),
    # ジト目・無表情
    "ISTP": dict(shine=(184, 210, 12), acc="beanie", eyes="jito", mouth="flat", cheeks="none", pose="hold", props=[("held_toolbox",)]),
    # うっとり上を見る・照れ
    "ISFP": dict(shine=(180, 204, 12), acc="beret", eyes="dreamy", brows="soft", mouth="smile", cheeks="blush", pose="hold", props=[("held_palette",)]),
    # サングラスで歯を見せてニッ
    "ESTP": dict(shine=(192, 222, 30), acc="bandana", eyes="dot", brows="confident", mouth="teeth", cheeks="none", pose="fist", deco=["sunglasses"], props=[("motion",)]),
    # ウインクで舌を出す
    "ESFP": dict(shine=(194, 230, 22), acc="catears", eyes="wink", brows="up", mouth="tongue", cheeks="heart", pose="mic", props=[("notes",)], in_hand=[("mic", 150, 131, 1.3)]),
}


def draw_prop(spec, c):
    name, *args = spec
    if name.startswith("held_"):
        return f'<g transform="translate(120 130) scale(1.25) translate(-120 -130)">{globals()[name](c)}</g>'
    fn = globals()[f"prop_{name}"]
    if len(args) == 3:  # (x, y, 大きさ)：その位置を中心に拡大する
        x, y, k = args
        inner = prop_uchiwa(x, y, c["blush"]) if name == "uchiwa" else fn(x, y)
        return f'<g transform="translate({x} {y}) scale({k}) translate({-x} {-y})">{inner}</g>'
    return fn(*args)


def front_arms(paths, c, uid):
    """体の前に回した腕（サンリオのキャラクターのように、短く太い腕の先に、指のない丸い手）。
    - 腕と手は 1 つの形として描く（輪郭を先にまとめて描き、その上に塗りを重ねる）ので、手首に線が出ない
    - 付け根は体の内側に置き、そのまわりを隠す。下には同じ色の体が見えるので、体から腕が生えて見える"""
    if not paths:
        return ""
    starts, ends = [], []
    for p in paths:
        nums = [float(v) for v in p[1:].replace("C", " ").replace(",", " ").split()]
        starts.append((nums[0], nums[1]))
        ends.append((nums[-2], nums[-1]))
    arm_w, hand_r = 16, 9.5
    d = "".join(f'<path d="{p}"/>' for p in paths)
    outline = (f'<g stroke="{LINE}" stroke-width="{arm_w + W}" fill="none" stroke-linecap="round">{d}</g>'
               + "".join(f'<circle cx="{x}" cy="{y}" r="{hand_r + W / 2}" fill="{LINE}"/>' for x, y in ends))
    fill = (f'<g stroke="{c["body"]}" stroke-width="{arm_w}" fill="none" stroke-linecap="round">{d}</g>'
            + "".join(f'<circle cx="{x}" cy="{y}" r="{hand_r - W / 2}" fill="{c["body"]}"/>' for x, y in ends))
    # 手のつや（小さな白い点）
    shine = "".join(f'<circle cx="{x - 3}" cy="{y - 3.5}" r="1.8" fill="#FFFFFF" opacity="0.8"/>' for x, y in ends)
    holes = "".join(f'<circle cx="{x}" cy="{y}" r="12" fill="#000"/>' for x, y in starts)
    mask = (f'<mask id="{uid}-arms" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">'
            f'<rect width="240" height="240" fill="#fff"/>{holes}</mask>')
    return f'{mask}<g mask="url(#{uid}-arms)">{outline}{fill}{shine}</g>'


def held_in_hand(props, paths, c, uid):
    """手でにぎる持ち物（マイクなど）。腕の上に描き、手の丸の中だけ消すので、持ち手が手の上と下から出て、にぎって見える"""
    if not props:
        return ""
    ends = [tuple(float(v) for v in p.replace(",", " ").split()[-2:]) for p in paths]
    holes = "".join(f'<circle cx="{x}" cy="{y}" r="{9.5 + W / 2}" fill="#000"/>' for x, y in ends)
    mask = (f'<mask id="{uid}-grip" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">'
            f'<rect width="240" height="240" fill="#fff"/>{holes}</mask>')
    return f'{mask}<g mask="url(#{uid}-grip)">{"".join(draw_prop(p, c) for p in props)}</g>'


def svg(c=None, size=240, uid="m", code="ESTJ"):
    """code に合った表情・ポーズ・持ち物・かぶりもので描く。code が 16 タイプにないときは土台（手を振る・点の目・ちゅの口・星のヘアピン）"""
    t = TYPES.get(code, dict(eyes="base", mouth="chu", pose="wave", props=[]))
    if c is None:
        c = GROUPS.get(GROUP_OF(code), {}) if code in TYPES else {}
    c = {**BASE, **c}
    pose = dict(POSES[t["pose"]])
    if "hands" in t:  # 持ち物に合わせて、前に回す腕の先（手）の位置を変える
        pose["front"] = t["hands"]
    leg_lines = [f"M{x} 138 Q {x} {y - 6}, {x + dx} {y}" for x, y, dx in LEGS]
    suckers = "".join(f'<circle cx="{x + dx * 1.05:.1f}" cy="{y + 3}" r="2.6"/>' for x, y, dx in LEGS)
    props = "".join(draw_prop(p, c) for p in t["props"])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="{size}" height="{size}">
  <defs><clipPath id="{uid}-head"><path d="{HEAD}"/></clipPath></defs>
  <ellipse cx="120" cy="194" rx="60" ry="6" fill="{LINE}" opacity="0.10"/>
  {tube(leg_lines, c["body"], 18)}
  {tube(pose.get("back", []), c["body"], 15)}
  <g fill="{c["sucker"]}">{suckers}</g>
  <path d="{HEAD}" fill="{c["body"]}" stroke="{LINE}" stroke-width="{W}"/>
  <g fill="{c["spot"]}"><circle cx="176" cy="92" r="5"/><circle cx="166" cy="104" r="3.2"/></g>
  {head_shine(*t.get("shine", SHINE_DEFAULT))}
  {(globals()[f"acc_{t['acc']}"]() if "acc" in t else hairpin()).replace("__HEAD_CLIP__", f"url(#{uid}-head)")}
  {cheeks(t.get("cheeks", "oval"), c)}
  {brows(t.get("brows", ""))}
  {eyes(t["eyes"], c)}
  {mouth(t["mouth"], c)}
  {face_deco(t.get("deco", []))}
  {props}
  {front_arms(pose.get("front", []), c, uid)}
  {held_in_hand(t.get("in_hand", []), pose.get("front", []), c, uid)}
  {"".join(draw_prop(p, c) for p in t.get("in_front", []))}
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
