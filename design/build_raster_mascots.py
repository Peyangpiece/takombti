"""手で仕上げた画像のタコ（public/mascots/*.png）を、シェア画像を描くサーバー用の data: にまとめる。
アプリの画面は public/mascots/*.png をそのまま読む。ここに無いタイプは SVG（src/data/mascots.ts）を使う。
小さく出すところ（トップの行進・回答の進み具合・メーターのつまみなど）のために、幅 240px の WebP も
public/mascots/s/<タイプ>.webp に書き出す（Pillow が要る。なければ書き出さず、前のものをそのまま使う）。
直すときは: public/mascots/<タイプ>.png を差し替えて python3 design/build_raster_mascots.py"""
import base64
import json
import os

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")
src = os.path.join(root, "public", "mascots")
codes = sorted(f[:-4] for f in os.listdir(src) if f.endswith(".png"))

with open(os.path.join(root, "src", "data", "mascotCodes.ts"), "w") as f:
    f.write("// このファイルは design/build_raster_mascots.py が書き出したもの。手で直さない\n")
    f.write("// 画像（public/mascots/<タイプ>.png）で描くタコのタイプ。画面はこの画像を読む\n")
    f.write(f"export const RASTER_MASCOTS: readonly string[] = {json.dumps(codes)};\n")

with open(os.path.join(root, "src", "data", "mascotsRaster.ts"), "w") as f:
    f.write("// このファイルは design/build_raster_mascots.py が書き出したもの。手で直さない\n")
    f.write("// シェア画像（サーバーで描く）用。画面の JS には入れない（src/lib/image.tsx からだけ読む）\n")
    data = {}
    for c in codes:
        with open(os.path.join(src, c + ".png"), "rb") as p:
            data[c] = "data:image/png;base64," + base64.b64encode(p.read()).decode()
    f.write("export const MASCOT_PNG: Record<string, string> = ")
    f.write(json.dumps(data, indent=2))
    f.write(";\n")
# 小さく出すとき用の画像（512px の PNG は 1 枚 60〜100KB あり、何体も並べると重いため）
SMALL = 240
try:
    from PIL import Image
except ImportError:
    Image = None
    print("Pillow がないので、小さい画像（public/mascots/s）は書き出していません")
if Image:
    small = os.path.join(src, "s")
    os.makedirs(small, exist_ok=True)
    for c in codes:
        with Image.open(os.path.join(src, c + ".png")) as im:
            im = im.convert("RGBA").resize((SMALL, SMALL), Image.LANCZOS)
            im.save(os.path.join(small, c + ".webp"), "WEBP", quality=86, method=6)
print(codes)
