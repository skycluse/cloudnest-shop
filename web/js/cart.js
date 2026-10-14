/* ============================================================
   cart.js —— 购物车状态管理
   ------------------------------------------------------------
   【这一节是考核 3.7 的核心：购物车状态管理逻辑】

   什么是"状态"（state）？
   就是"现在购物车里有什么"这个事实。它存在内存里，也存进
   localStorage（浏览器的本地存储），这样刷新页面购物车不会丢。

   设计要点：
   1. 只有一个数据源 cartState，所有显示都从它算出来 ——
      不要这里存一份、那里存一份，否则两边会不一致（这叫 bug 温床）
   2. 任何修改都必须通过下面这几个函数，不允许外部直接改 cartState
   3. 改完之后调用 notify()，让页面重新渲染
   ============================================================ */

// localStorage 的 key（键名），相当于存东西时的"抽屉标签"
var CART_STORAGE_KEY = 'cloudnest_cart_v1';

/**
 * 购物车的数据结构。
 * items 里每一项是 { productId, name, price, image, stock, brand, quantity }
 *
 * 为什么存 name/price/image，不只存 productId？
 * 因为渲染时需要这些信息。如果只存 id，每次渲染都要再请求一次后端，
 * 那样很慢，而且离线时购物车就空白了。
 * （真实项目里会更严谨：加购时校验一次，下单时再由后端复核价格）
 */
var cartState = {
  items: []
};

// 保存所有"关心购物车变化"的回调函数
var cartListeners = [];

/* ============================================================
   一、读写 localStorage
   ============================================================ */

/**
 * 从 localStorage 把购物车读回来。
 * localStorage 只能存字符串，所以存的时候 JSON.stringify，
 * 读的时候 JSON.parse。
 */
function loadCartFromStorage() {
  try {
    var raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return;

    var parsed = JSON.parse(raw);

    // 防御性检查：数据可能被人手动改坏，或者旧版本格式不一样
    if (parsed && Array.isArray(parsed.items)) {
      cartState.items = parsed.items;
    }
  } catch (err) {
    // 解析失败就当购物车是空的，不要让整个页面挂掉
    console.warn('购物车数据读取失败，已重置：', err);
    cartState.items = [];
  }
}

/**
 * 把购物车写进 localStorage
 */
function saveCartToStorage() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
  } catch (err) {
    // 隐私模式或存储满了会失败，提示一下但不影响使用
    console.warn('购物车保存失败：', err);
  }
}

/* ============================================================
   二、订阅 / 通知（观察者模式的最简实现）
   ------------------------------------------------------------
   页面可以这样"订阅"：
       cart.subscribe(function (state) { 重新渲染购物车(); });
   之后购物车一变，这个函数就会被自动调用。
   ============================================================ */

/**
 * 注册一个监听函数
 * @param {Function} listener 购物车变化时会被调用，参数是 cartState
 */
function subscribe(listener) {
  if (typeof listener === 'function') {
    cartListeners.push(listener);
  }
}

/**
 * 通知所有监听者：购物车变了，请重新渲染
 */
function notify() {
  for (var i = 0; i < cartListeners.length; i++) {
    try {
      cartListeners[i](cartState);
    } catch (err) {
      // 一个监听器报错不应该影响其它监听器
      console.error('购物车监听器执行出错：', err);
    }
  }
}

/**
 * 每次修改后统一走这里：存盘 + 通知
 */
function commit() {
  saveCartToStorage();
  notify();
}

/* ============================================================
   三、查询（只读，不改数据）
   ============================================================ */

/**
 * 按商品 id 找出购物车里的那一项，没有就返回 null
 */
function findItem(productId) {
  var target = Number(productId);

  for (var i = 0; i < cartState.items.length; i++) {
    if (Number(cartState.items[i].productId) === target) {
      return cartState.items[i];
    }
  }
  return null;
}

/**
 * 购物车里一共有多少件商品（把数量加起来）
 */
function getTotalCount() {
  var total = 0;
  for (var i = 0; i < cartState.items.length; i++) {
    total += Number(cartState.items[i].quantity) || 0;
  }
  return total;
}

/**
 * 购物车总金额
 */
function getTotalPrice() {
  var total = 0;
  for (var i = 0; i < cartState.items.length; i++) {
    var item = cartState.items[i];
    total += (Number(item.price) || 0) * (Number(item.quantity) || 0);
  }
  // 浮点数相加会出现 0.30000000000000004 这种精度问题，
  // 用 toFixed 再转回数字来修正
  return Number(total.toFixed(2));
}

/**
 * 某一项的小计金额（单价 × 数量）—— 考核要求"计算单项商品金额"
 */
function getItemSubtotal(item) {
  if (!item) return 0;
  return Number(((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2));
}

/**
 * 购物车是不是空的
 */
function isEmpty() {
  return cartState.items.length === 0;
}

/**
 * 拿一份 items 的副本给外部渲染用。
 * 为什么给副本？防止外部不小心改到内部数据。
 */
function getItems() {
  return cartState.items.slice();
}

/**
 * 转成下单接口需要的格式：只保留 productId 和 quantity
 */
function toOrderItems() {
  var result = [];
  for (var i = 0; i < cartState.items.length; i++) {
    result.push({
      productId: cartState.items[i].productId,
      quantity: cartState.items[i].quantity
    });
  }
  return result;
}

/* ============================================================
   四、修改（写操作）
   ============================================================ */

/**
 * 加入购物车。
 * 如果商品已经在车里，就累加数量；否则新增一项。
 *
 * @param {object} product 商品对象（来自后端接口）
 * @param {number} quantity 加几件，默认 1
 * @returns {{ok: boolean, message: string}}
 */
function add(product, quantity) {
  var qty = Number(quantity) || 1;

  if (!product || !product.id) {
    return { ok: false, message: '商品信息不完整' };
  }

  if (qty <= 0) {
    return { ok: false, message: '数量必须大于 0' };
  }

  var stock = Number(product.stock) || 0;
  if (stock <= 0) {
    return { ok: false, message: '「' + product.name + '」已售罄' };
  }

  var existing = findItem(product.id);
  var currentQty = existing ? existing.quantity : 0;

  // 库存校验：不能加超过库存的数量
  if (currentQty + qty > stock) {
    return {
      ok: false,
      message: '库存不足，「' + product.name + '」最多还能加 ' + (stock - currentQty) + ' 件'
    };
  }

  if (existing) {
    existing.quantity = currentQty + qty;
  } else {
    cartState.items.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image,
      brand: product.brand,
      category: product.category,
      stock: stock,
      quantity: qty
    });
  }

  commit();
  return { ok: true, message: '已加入购物车' };
}

/**
 * 直接设置某个商品的数量（数量为 0 就删除它）
 * 步进器的 "+" "-" 都调用它
 */
function updateQuantity(productId, quantity) {
  var qty = Number(quantity);
  var item = findItem(productId);

  if (!item) {
    return { ok: false, message: '购物车里没有这个商品' };
  }

  if (isNaN(qty) || qty < 0) {
    return { ok: false, message: '数量不合法' };
  }

  // 改成 0 等于删除
  if (qty === 0) {
    return remove(productId);
  }

  if (qty > item.stock) {
    return { ok: false, message: '库存只有 ' + item.stock + ' 件' };
  }

  item.quantity = qty;
  commit();
  return { ok: true, message: '已更新数量' };
}

/**
 * 数量 +1
 */
function increase(productId) {
  var item = findItem(productId);
  if (!item) return { ok: false, message: '商品不在购物车中' };
  return updateQuantity(productId, item.quantity + 1);
}

/**
 * 数量 -1（减到 0 就删除）
 */
function decrease(productId) {
  var item = findItem(productId);
  if (!item) return { ok: false, message: '商品不在购物车中' };
  return updateQuantity(productId, item.quantity - 1);
}

/**
 * 从购物车移除某个商品
 */
function remove(productId) {
  var target = Number(productId);
  var newItems = [];

  for (var i = 0; i < cartState.items.length; i++) {
    if (Number(cartState.items[i].productId) !== target) {
      newItems.push(cartState.items[i]);
    }
  }

  if (newItems.length === cartState.items.length) {
    return { ok: false, message: '购物车里没有这个商品' };
  }

  cartState.items = newItems;
  commit();
  return { ok: true, message: '已从购物车移除' };
}

/**
 * 清空购物车 —— 考核要求的功能之一
 */
function clear() {
  if (cartState.items.length === 0) {
    return { ok: false, message: '购物车已经是空的' };
  }
  cartState.items = [];
  commit();
  return { ok: true, message: '购物车已清空' };
}

/**
 * 用后端的真实库存刷新购物车里的库存信息。
 * 为什么需要？因为用户可能开着页面很久，期间库存被别的订单买走了。
 * 下单失败时调用它，能把过时的数据修正过来。
 */
function refreshStock(product) {
  if (!product || !product.id) return;
  var item = findItem(product.id);
  if (!item) return;

  item.stock = Number(product.stock) || 0;
  item.price = Number(product.price);
  item.name = product.name;

  // 库存变少了，车里数量超了，就自动降到库存上限
  if (item.quantity > item.stock) {
    item.quantity = Math.max(0, item.stock);
  }

  // 降到 0 就移除
  if (item.quantity === 0) {
    remove(product.id);
    return;
  }

  commit();
}

/* ============================================================
   五、初始化
   ============================================================ */

/**
 * 页面加载时调用一次，把 localStorage 里的购物车读回来并通知界面渲染。
 * 每个页面开头都要写：cart.init();
 */
function init() {
  loadCartFromStorage();
  notify();
}

// 挂到 window.cart
window.cart = {
  init: init,
  subscribe: subscribe,
  // 查询
  getItems: getItems,
  findItem: findItem,
  getTotalCount: getTotalCount,
  getTotalPrice: getTotalPrice,
  getItemSubtotal: getItemSubtotal,
  isEmpty: isEmpty,
  toOrderItems: toOrderItems,
  // 修改
  add: add,
  updateQuantity: updateQuantity,
  increase: increase,
  decrease: decrease,
  remove: remove,
  clear: clear,
  refreshStock: refreshStock
};
