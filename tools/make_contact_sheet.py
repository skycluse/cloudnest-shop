# -*- coding: utf-8 -*-
"""
把 24 张商品图拼成一张联系表（contact sheet），方便一眼检查图片内容对不对。
为什么要这么做？下载成功 ≠ 图片内容正确。
图库的图片 ID 可能失效、可能返回完全不相干的图片，
必须用眼睛看一遍才算验证通过。
"""
import os
from PIL import Image, ImageDraw, ImageFont

SRC = r"C:\Users\rain\Desktop\cloudnest-shop\web\assets\products"
OUT = r"C:\Users\rain\Desktop\cloudnest-shop\docs\screenshots\_contact_sheet.png"

FILES = [
    "earphone-1.jpg", "earphone-2.jpg", "earphone-3.jpg",
    "earphone-4.jpg", "earphone-5.jpg", "earphone-6.jpg",
    "keyboard-1.jpg", "keyboard-2.jpg", "keyboard-3.jpg",
    "keyboard-4.jpg", "keyboard-5.jpg", "keyboard-6.jpg",
    "mouse-1.jpg", "mouse-2.jpg", "mouse-3.jpg",
    "power-1.jpg", "power-2.jpg", "power-3.jpg",
    "smart-1.jpg", "smart-2.jpg", "smart-3.jpg",
    "acc-1.jpg", "acc-2.jpg", "acc-3.jpg",
]

COLS = 6
CELL = 220          # 每格宽度
PAD = 6
LABEL_H = 18

rows = (len(FILES) + COLS - 1) // COLS
W = COLS * (CELL + PAD) + PAD
H = rows * (CELL + PAD + LABEL_H) + PAD

sheet = Image.new("RGB", (W, H), (245, 246, 248))
draw = ImageDraw.Draw(sheet)

try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
except Exception:
    font = ImageFont.load_default()


def center_crop_square(img, size):
    """居中裁剪成正方形，再缩放 —— 商品图这样显示最整齐。"""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    return img.resize((size, size), Image.LANCZOS)


for i, name in enumerate(FILES):
    r, c = divmod(i, COLS)
    x = PAD + c * (CELL + PAD)
    y = PAD + r * (CELL + PAD + LABEL_H)

    path = os.path.join(SRC, name)
    try:
        im = Image.open(path).convert("RGB")
        im = center_crop_square(im, CELL)
        sheet.paste(im, (x, y))
    except Exception as e:
        draw.rectangle([x, y, x + CELL, y + CELL], fill=(255, 220, 220))
        draw.text((x + 8, y + 8), f"ERR\n{name}", fill=(200, 0, 0), font=font)

    # 标签
    label = name.replace(".jpg", "")
    draw.text((x + 3, y + CELL + 2), label, fill=(60, 60, 60), font=font)

sheet.save(OUT, "PNG")
print("联系表已生成:", OUT)
print("尺寸:", sheet.size, " 图片数:", len(FILES))
