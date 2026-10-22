/**
 * 数据存储层（这里是最简单的"假装是数据库"的写法）
 * ------------------------------------------------------------
 * 商品是"只读"的，直接从 data/products.js 读。
 * 订单是"会变多"的，所以要写进文件保存下来，重启服务不丢。
 *
 * 【重要】以后想升级成真正的数据库（比如 SQLite / MySQL / PostgreSQL），
 * 只需要把这个文件里的函数重新实现一遍，其它文件都不用改。
 * 这就是后端的"分层"思想：路由层管收请求，存储层管数据。
 */

const fs = require('fs');
const path = require('path');
const { products, categories } = require('./data/products');

// 订单文件的位置：server/data/orders.json
// 注意：store.js 本身在 server/ 目录下，
// 所以这里必须写成 path.join(__dirname, 'data', 'orders.json')。
// 之前漏掉了 'data'，导致订单被写到了 server/orders.json，和注释不一致。
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

/**
 * 从文件里读出所有订单。
 * 文件不存在、或者是空的/坏的，就返回空数组，不让程序崩。
 */
function readOrders() {
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    // 文件不存在是正常情况（第一次运行），不算错误
    return [];
  }
}

/**
 * 把所有订单写回文件。
 * 用 2 个空格缩进，这样用编辑器打开 orders.json 也能看懂。
 */
function writeOrders(list) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/* ============================================================
 *  商品相关
 * ============================================================ */

/**
 * 查询商品列表，支持搜索 / 筛选 / 排序 / 分页。
 * @param {object} query 全部来自 URL 上的查询参数（?keyword=xx&category=yy）
 */
function findProducts(query) {
  // 先把查询参数一个个取出来，并给上默认值
  const keyword = (query.keyword || '').trim().toLowerCase();
  const category = (query.category || '').trim();
  const minPrice = query.minPrice === undefined || query.minPrice === '' ? null : Number(query.minPrice);
  const maxPrice = query.maxPrice === undefined || query.maxPrice === '' ? null : Number(query.maxPrice);
  const sort = (query.sort || 'default').trim();
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(60, Math.max(1, parseInt(query.pageSize, 10) || 12));

  // 1) 过滤：一层层筛，能留下来的才进入下一步
  let list = products.slice(); // slice() 复制一份，避免改到原数组

  if (keyword) {
    list = list.filter(function (p) {
      // 商品名、简介、标签、品牌、分类名都参与搜索
      const haystack = [
        p.name,
        p.tagline,
        p.brand,
        p.desc,
        (p.tags || []).join(' ')
      ].join(' ').toLowerCase();
      return haystack.indexOf(keyword) !== -1;
    });
  }

  if (category) {
    list = list.filter(function (p) {
      return p.category === category;
    });
  }

  if (minPrice !== null && !Number.isNaN(minPrice)) {
    list = list.filter(function (p) { return p.price >= minPrice; });
  }

  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    list = list.filter(function (p) { return p.price <= maxPrice; });
  }

  // 2) 排序
  if (sort === 'price_asc') {
    list.sort(function (a, b) { return a.price - b.price; });
  } else if (sort === 'price_desc') {
    list.sort(function (a, b) { return b.price - a.price; });
  } else if (sort === 'rating') {
    list.sort(function (a, b) { return b.rating - a.rating; });
  }

  // 3) 分页：从第 (page-1)*pageSize 条开始，取 pageSize 条
  const total = list.length;
  const start = (page - 1) * pageSize;
  const items = list.slice(start, start + pageSize);

  return {
    items: items,
    total: total,
    page: page,
    pageSize: pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

/**
 * 按 id 找单个商品，找不到返回 null。
 */
function findProductById(id) {
  const target = Number(id);
  for (let i = 0; i < products.length; i++) {
    if (products[i].id === target) return products[i];
  }
  return null;
}

/* ============================================================
 *  订单相关
 * ============================================================ */

/**
 * 生成订单编号，格式：CN + 年月日时分秒 + 3 位随机数
 * 例：CN20260926143012-482
 */
function makeOrderNo() {
  const d = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  const stamp =
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  const rand = Math.floor(Math.random() * 900) + 100;
  return 'CN' + stamp + '-' + rand;
}

/**
 * 创建订单。
 * @param {object} payload 前端传来的下单数据
 *   { items: [{ productId, quantity }], customer: { name, phone, address }, remark }
 * @returns {{ok: true, order: object} | {ok: false, message: string}}
 */
function createOrder(payload) {
  const items = payload && payload.items;

  // --- 参数校验：前端可能传错，必须防住 ---
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: '订单商品不能为空' };
  }

  const customer = payload.customer || {};
  if (!customer.name || !String(customer.name).trim()) {
    return { ok: false, message: '请填写收货人姓名' };
  }
  if (!customer.phone || !/^1[3-9]\d{9}$/.test(String(customer.phone).trim())) {
    return { ok: false, message: '请填写正确的 11 位手机号' };
  }
  if (!customer.address || !String(customer.address).trim()) {
    return { ok: false, message: '请填写收货地址' };
  }

  // --- 逐条核对商品：存不存在、库存够不够、数量正不正常 ---
  const orderItems = [];
  let totalPrice = 0;

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const quantity = parseInt(raw && raw.quantity, 10);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, message: '商品数量必须是大于 0 的整数' };
    }

    const product = findProductById(raw && raw.productId);
    if (!product) {
      return { ok: false, message: '商品不存在（id: ' + raw.productId + '）' };
    }
    if (product.stock < quantity) {
      return {
        ok: false,
        message: '「' + product.name + '」库存不足，当前仅剩 ' + product.stock + ' 件'
      };
    }

    const subtotal = product.price * quantity;
    totalPrice += subtotal;

    // 订单里存一份"下单当时的商品快照"。
    // 为什么不只存 productId？因为商品以后可能改价或下架，
    // 存快照才能保证历史订单显示的是当时真实的价格。
    orderItems.push({
      productId: product.id,
      name: product.name,
      image: product.image,
      brand: product.brand,
      category: product.category,
      price: product.price,
      quantity: quantity,
      subtotal: subtotal
    });
  }

  // --- 扣库存（项目里商品数据是内存中的，重启会还原，这样演示够了）---
  for (let i = 0; i < orderItems.length; i++) {
    const product = findProductById(orderItems[i].productId);
    product.stock -= orderItems[i].quantity;
  }

  const order = {
    id: makeOrderNo(),
    // 谁下的单。未登录用户下单时为 null（游客订单）。
    // 有这个字段之后，订单页就能只显示"我的订单"。
    userId: payload.userId || null,
    items: orderItems,
    itemCount: orderItems.reduce(function (sum, it) { return sum + it.quantity; }, 0),
    totalPrice: totalPrice,
    customer: {
      name: String(customer.name).trim(),
      phone: String(customer.phone).trim(),
      address: String(customer.address).trim()
    },
    remark: String(payload.remark || '').trim(),
    // 没有接真实支付，先固定成"已支付（模拟）"
    status: 'PAID',
    statusText: '已支付（模拟）',
    createdAt: new Date().toISOString()
  };

  const all = readOrders();
  all.unshift(order); // 新的放最前面，列表页就不用再排序
  writeOrders(all);

  return { ok: true, order: order };
}

/**
 * 按订单号查订单。
 */
function findOrderById(id) {
  const all = readOrders();
  for (let i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

/**
 * 查某个用户的全部订单（最新的在前）。
 */
function listOrdersByUser(userId) {
  const target = Number(userId);
  return readOrders().filter(function (o) {
    return Number(o.userId) === target;
  });
}

/**
 * 按订单号批量查订单。用于"未登录但本机下过单"的场景：
 * 前端把本机订单号列表传上来，这里按 id 查回来。
 *
 * 为什么要限制最多 50 个？
 * 防止有人传一万个 id 来探测别人的订单。
 */
function listOrdersByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const wanted = ids.slice(0, 50).map(function (id) { return String(id); });
  const all = readOrders();

  return all.filter(function (o) {
    return wanted.indexOf(String(o.id)) !== -1;
  });
}

/**
 * 查全部订单。只给内部调试用，接口不会直接暴露它。
 */
function listOrders() {
  return readOrders();
}

module.exports = {
  categories,
  products,
  findProducts,
  findProductById,
  createOrder,
  findOrderById,
  listOrdersByUser,
  listOrdersByIds,
  listOrders
};
