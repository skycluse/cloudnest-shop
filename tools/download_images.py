# -*- coding: utf-8 -*-
"""
真实商品图片下载脚本
------------------------------------------------------------
为什么用脚本而不是手动下载 24 张？
1. 可重复：图片挂了好重新跑
2. 有记录：每张图的来源 ID 都写在代码里，方便溯源
3. 能校验：自动检查下载的是不是真图片、大小是否合理

图片来源：Unsplash / Pexels（都是免费可商用图库）
下载的是"固定尺寸的压缩版"（w=800&q=80），不是原图，
好处是体积小、加载快，适合做商品列表。
"""

import os
import sys
import time
import urllib.request
import urllib.error

OUT_DIR = r"C:\Users\rain\Desktop\cloudnest-shop\web\assets\products"

# ============================================================
# 每个商品对应的真实照片
# 格式：文件名 -> (图片URL, 说明)
#
# 说明：这些是图库里的真实商品摄影图。
# 因为图库照片不可能和我们的商品名一一对应（我们卖的是"云巢"品牌），
# 所以选择标准是【品类和形态对得上】：
#   入耳式耳机 → 拍入耳耳机的照片
#   头戴式耳机 → 拍头戴耳机的照片
#   以此类推
# ============================================================

IMAGES = {
    # ---------- 耳机音频（6）----------
    "earphone-1.jpg": (
        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80&fm=jpg",
        "入耳式无线耳机（运动款）"
    ),
    "earphone-2.jpg": (
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80&fm=jpg",
        "头戴式耳机（降噪款）"
    ),
    "earphone-3.jpg": (
        "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&q=80&fm=jpg",
        "真无线耳机（充电盒）"
    ),
    "earphone-4.jpg": (
        "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80&fm=jpg",
        "头戴式耳机（运动款）"
    ),
    "earphone-5.jpg": (
        "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80&fm=jpg",
        "头戴式耳机（通勤款）"
    ),
    "earphone-6.jpg": (
        "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=800&q=80&fm=jpg",
        "有线入耳耳机"
    ),

    # ---------- 键盘外设（6）----------
    "keyboard-1.jpg": (
        "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80&fm=jpg",
        "机械键盘（三模）"
    ),
    "keyboard-2.jpg": (
        "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80&fm=jpg",
        "机械键盘（小配列）"
    ),
    "keyboard-3.jpg": (
        "https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80&fm=jpg",
        "全尺寸键盘"
    ),
    "keyboard-4.jpg": (
        "https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=800&q=80&fm=jpg",
        "客制化键盘（铝合金）"
    ),
    "keyboard-5.jpg": (
        "https://images.unsplash.com/photo-1601445638532-3c6f6c3aa1d6?w=800&q=80&fm=jpg",
        "静音机械键盘"
    ),
    "keyboard-6.jpg": (
        "https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80&fm=jpg",
        "薄膜办公键盘（超薄）"
    ),

    # ---------- 鼠标（3）----------
    "mouse-1.jpg": (
        "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80&fm=jpg",
        "无线鼠标（办公静音）"
    ),
    "mouse-2.jpg": (
        "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80&fm=jpg",
        "电竞鼠标（轻量化）"
    ),
    "mouse-3.jpg": (
        "https://images.unsplash.com/photo-1613141411244-0e4ac259d217?w=800&q=80&fm=jpg",
        "游戏鼠标（RGB）"
    ),

    # ---------- 充电储能（3）----------
    "power-1.jpg": (
        "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80&fm=jpg",
        "充电宝（大容量）"
    ),
    "power-2.jpg": (
        "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80&fm=jpg",
        "充电器（氮化镓）"
    ),
    "power-3.jpg": (
        "https://images.unsplash.com/photo-1618410320928-25228d811631?w=800&q=80&fm=jpg",
        "磁吸无线充电宝"
    ),

    # ---------- 智能家居（3）----------
    "smart-1.jpg": (
        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80&fm=jpg",
        "护眼台灯"
    ),
    "smart-2.jpg": (
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&fm=jpg",
        "智能插座"
    ),
    "smart-3.jpg": (
        "https://images.unsplash.com/photo-1589003077984-894e133dabab?w=800&q=80&fm=jpg",
        "智能音箱"
    ),

    # ---------- 配件周边（3）----------
    "acc-1.jpg": (
        "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80&fm=jpg",
        "桌面理线/收纳"
    ),
    "acc-2.jpg": (
        "https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=800&q=80&fm=jpg",
        "笔记本支架"
    ),
    "acc-3.jpg": (
        "https://images.unsplash.com/photo-1616763355548-1b606f439f86?w=800&q=80&fm=jpg",
        "大号鼠标垫"
    ),
}

# 图片请求头：图库会检查 User-Agent，不加可能被拒
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/jpeg,image/*,*/*;q=0.8",
}


def is_valid_image(path):
    """检查文件是不是真正的图片（不只看大小，还看文件头）。"""
    if not os.path.exists(path):
        return False, "文件不存在"

    size = os.path.getsize(path)
    if size < 3000:
        return False, f"文件太小（{size} 字节），可能是错误页面"

    with open(path, "rb") as f:
        head = f.read(4)

    # JPEG 以 FF D8 开头，PNG 以 89 50 4E 47 开头
    if head[:2] == b"\xff\xd8":
        return True, f"JPEG {size} 字节"
    if head[:4] == b"\x89PNG":
        return True, f"PNG {size} 字节"

    return False, f"不是图片格式，文件头={head.hex()}"


def download(name, url):
    path = os.path.join(OUT_DIR, name)
    req = urllib.request.Request(url, headers=HEADERS)

    with urllib.request.urlopen(req, timeout=45) as resp:
        data = resp.read()

    with open(path, "wb") as f:
        f.write(data)

    return path


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    ok_count = 0
    fail_list = []

    print(f"开始下载 {len(IMAGES)} 张商品图片...\n")

    for i, (name, (url, desc)) in enumerate(IMAGES.items(), 1):
        path = os.path.join(OUT_DIR, name)

        # 已经下载好的就跳过（重复运行不会重复下载）
        valid, info = is_valid_image(path)
        if valid:
            print(f"  [{i:2}/{len(IMAGES)}] 跳过 {name:<18} 已存在 ({info})")
            ok_count += 1
            continue

        try:
            download(name, url)
            valid, info = is_valid_image(path)
            if valid:
                print(f"  [{i:2}/{len(IMAGES)}] OK   {name:<18} {desc}  ({info})")
                ok_count += 1
            else:
                print(f"  [{i:2}/{len(IMAGES)}] BAD  {name:<18} {info}")
                fail_list.append((name, desc, info))
        except Exception as e:
            msg = str(e)[:70]
            print(f"  [{i:2}/{len(IMAGES)}] FAIL {name:<18} {msg}")
            fail_list.append((name, desc, msg))

        time.sleep(0.35)   # 慢一点，避免被图库限流

    print("\n" + "=" * 62)
    print(f"  成功 {ok_count} / {len(IMAGES)}")
    if fail_list:
        print("  失败清单：")
        for name, desc, why in fail_list:
            print(f"    - {name} ({desc}): {why}")
    print("=" * 62)

    return 0 if not fail_list else 1


if __name__ == "__main__":
    sys.exit(main())
