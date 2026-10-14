# -*- coding: utf-8 -*-
"""
生成商品占位图（SVG）。
为什么要用 SVG 而不是 PNG/JPG？
1. SVG 是矢量图，放大不糊 —— 商品图在不同屏幕尺寸下都清晰
2. 文件极小（每个 1KB 左右），不拖慢页面
3. 纯文本，可以直接用编辑器打开改颜色
"""

import os

OUT_DIR = r"C:\Users\rain\Desktop\cloudnest-shop\web\assets\products"

# (文件名, emoji, 主色, 次色, 显示名)
ITEMS = [
    ("earphone-1.svg", "🎧", "#6366f1", "#c7d2fe", "运动蓝牙耳机"),
    ("earphone-2.svg", "🎧", "#4f46e5", "#a5b4fc", "头戴降噪耳机"),
    ("earphone-3.svg", "🎵", "#0ea5e9", "#bae6fd", "真无线耳机"),
    ("earphone-4.svg", "🎧", "#8b5cf6", "#ddd6fe", "运动降噪耳机"),
    ("earphone-5.svg", "🎧", "#06b6d4", "#a5f3fc", "通勤降噪耳机"),
    ("earphone-6.svg", "🎶", "#64748b", "#cbd5e1", "有线入耳耳机"),

    ("keyboard-1.svg", "⌨️", "#4f46e5", "#c7d2fe", "三模机械键盘"),
    ("keyboard-2.svg", "⌨️", "#7c3aed", "#ddd6fe", "便携机械键盘"),
    ("keyboard-3.svg", "⌨️", "#2563eb", "#bfdbfe", "全尺寸机械键盘"),
    ("keyboard-4.svg", "⌨️", "#1e293b", "#94a3b8", "客制化机械键盘"),
    ("keyboard-5.svg", "⌨️", "#0891b2", "#a5f3fc", "静音机械键盘"),
    ("keyboard-6.svg", "⌨️", "#94a3b8", "#e2e8f0", "薄膜办公键盘"),

    ("mouse-1.svg", "🖱️", "#0ea5e9", "#bae6fd", "无线静音鼠标"),
    ("mouse-2.svg", "🖱️", "#6366f1", "#c7d2fe", "无线电竞鼠标"),
    ("mouse-3.svg", "🖱️", "#8b5cf6", "#ddd6fe", "有线游戏鼠标"),

    ("power-1.svg", "🔋", "#10b981", "#a7f3d0", "充电宝"),
    ("power-2.svg", "🔌", "#f59e0b", "#fde68a", "氮化镓充电器"),
    ("power-3.svg", "🔋", "#14b8a6", "#99f6e4", "磁吸充电宝"),

    ("smart-1.svg", "💡", "#f59e0b", "#fef3c7", "护眼台灯"),
    ("smart-2.svg", "🔌", "#22c55e", "#bbf7d0", "智能插座"),
    ("smart-3.svg", "🔊", "#ec4899", "#fbcfe8", "智能音箱"),

    ("acc-1.svg", "🧩", "#64748b", "#e2e8f0", "理线器套装"),
    ("acc-2.svg", "💻", "#475569", "#cbd5e1", "笔记本支架"),
    ("acc-3.svg", "🖱️", "#7c3aed", "#e9d5ff", "加厚鼠标垫"),
]

TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="{label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c2}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="42%">
      <stop offset="0%" stop-color="{c1}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="{c1}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="400" height="300" fill="url(#bg)"/>
  <circle cx="200" cy="135" r="118" fill="url(#glow)"/>

  <circle cx="200" cy="135" r="86" fill="#ffffff" opacity="0.72"/>
  <circle cx="200" cy="135" r="86" fill="none" stroke="{c1}" stroke-opacity="0.28" stroke-width="1.5"/>

  <text x="200" y="167" font-size="88" text-anchor="middle" dominant-baseline="middle">{emoji}</text>

  <text x="200" y="262" font-size="17" font-weight="600" fill="{c1}"
        text-anchor="middle" font-family="'PingFang SC','Microsoft YaHei',sans-serif"
        opacity="0.85">{label}</text>
</svg>
"""


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for filename, emoji, c1, c2, label in ITEMS:
        svg = TEMPLATE.format(emoji=emoji, c1=c1, c2=c2, label=label)
        path = os.path.join(OUT_DIR, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        print("created", filename, os.path.getsize(path), "bytes")
    print("\ntotal:", len(ITEMS), "images")


if __name__ == "__main__":
    main()
