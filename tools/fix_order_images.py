# -*- coding: utf-8 -*-
"""
修复历史订单里失效的图片路径。
------------------------------------------------------------
问题：
  下单时后端会把商品信息做"快照"存进订单（价格、名称、图片路径）。
  这样设计是对的 —— 商品以后改价下架，历史订单仍能看到当时的样子。
  但副作用是：我们把商品图从 .svg 换成 .jpg 之后，
  已经存下来的订单里还是旧的 .svg 路径，图片就 404 了。

解决思路：
  遍历所有订单，检查每个商品的 image 路径：
  1. 如果文件还存在 → 不动
  2. 如果不存在（比如 .svg 已删）→ 尝试同名 .jpg
  3. .jpg 也没有 → 去商品库里按 productId 查最新的图片路径
  4. 还找不到 → 标记出来，人工处理

为什么要按这个顺序？
  因为"同名换扩展名"通常就是正确答案（earphone-2.svg -> earphone-2.jpg），
  比查商品库更直接、更不容易出错。
"""
import io
import json
import os

ROOT = r"C:\Users\rain\Desktop\cloudnest-shop"
ORDERS_FILE = os.path.join(ROOT, "server", "data", "orders.json")
IMG_DIR = os.path.join(ROOT, "web", "assets", "products")
PRODUCTS_FILE = os.path.join(ROOT, "server", "data", "products.js")


def image_exists(web_path):
    """web_path 形如 /assets/products/earphone-2.jpg，判断对应文件在不在。"""
    if not web_path:
        return False
    rel = web_path.lstrip("/").replace("/", os.sep)
    return os.path.exists(os.path.join(ROOT, "web", rel))


def try_swap_ext(web_path):
    """把 .svg 换成 .jpg 试试（反过来也试）。"""
    base, ext = os.path.splitext(web_path)
    for new_ext in (".jpg", ".jpeg", ".png", ".webp", ".svg"):
        if new_ext == ext:
            continue
        cand = base + new_ext
        if image_exists(cand):
            return cand
    return None


def load_product_images():
    """从 products.js 里解析出 id -> image 的映射。

    这里用正则而不是 require：
    因为 products.js 是 CommonJS 模块，require 进来是一个对象，
    但用正则更轻量，也不依赖执行环境。
    """
    mapping = {}
    with io.open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        src = f.read()

    # 按 "{ ... id: 1, ... }" 逐个商品块解析
    import re
    blocks = re.split(r"\n  \{", src)
    for b in blocks:
        m_id = re.search(r"id:\s*(\d+)", b)
        m_img = re.search(r"image:\s*'([^']+)'", b)
        if m_id and m_img:
            mapping[int(m_id.group(1))] = m_img.group(1)
    return mapping


def main():
    if not os.path.exists(ORDERS_FILE):
        print("没有订单文件，无需修复")
        return 0

    with io.open(ORDERS_FILE, "r", encoding="utf-8") as f:
        orders = json.load(f)

    if not isinstance(orders, list) or not orders:
        print("订单为空，无需修复")
        return 0

    product_images = load_product_images()
    print("商品库里共 %d 个商品的图片路径\n" % len(product_images))

    fixed = 0
    broken = []

    for order in orders:
        for item in order.get("items", []):
            old = item.get("image", "")

            # 1) 本来就正常
            if image_exists(old):
                print("  OK      %s" % old)
                continue

            # 2) 尝试换个扩展名
            new = try_swap_ext(old)

            # 3) 换不了就查商品库
            if not new:
                new = product_images.get(item.get("productId"))

            if new and image_exists(new):
                item["image"] = new
                fixed += 1
                print("  修复    %s  ->  %s" % (old, new))
            else:
                broken.append((order.get("id"), item.get("name"), old))
                print("  修不了  %s（商品：%s）" % (old, item.get("name")))

    # 写回
    if fixed > 0:
        with io.open(ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(orders, f, ensure_ascii=False, indent=2)
        print("\n已写入 %s" % ORDERS_FILE)

    print("\n" + "=" * 54)
    print("  修复 %d 处，仍有问题 %d 处" % (fixed, len(broken)))
    print("=" * 54)

    return 0 if not broken else 1


if __name__ == "__main__":
    raise SystemExit(main())
