/* ============================================================
   orders.js —— 订单页逻辑
   ------------------------------------------------------------
   两种模式：
   1. orders.html          → 订单列表
   2. orders.html?id=xxx   → 顶部额外显示某一笔订单的详情

   【必须先登录】
   下单要求登录，所以订单一定挂在某个账号下。
   未登录访问订单页会显示登录引导，不发请求。
   ============================================================ */

/* ============================================================
   一、渲染单个订单卡片
   ============================================================ */

/**
 * 生成一张订单卡片的 HTML
 * @param {object} order 订单数据
 */
function orderCardHtml(order) {
  /* ---- 商品行 ---- */
  var itemsHtml = '';
  for (var i = 0; i < order.items.length; i++) {
    var item = order.items[i];
    itemsHtml +=
      '<div class="order-item">' +
        '<a href="./product.html?id=' + item.productId + '">' +
          '<img class="order-item-img" src="' + utils.escapeHtml(item.image) + '" ' +
               'alt="' + utils.escapeHtml(item.name) + '" loading="lazy" />' +
        '</a>' +

        '<div class="order-item-info">' +
          '<a href="./product.html?id=' + item.productId + '">' +
            '<div class="order-item-name">' + utils.escapeHtml(item.name) + '</div>' +
          '</a>' +
          '<div class="order-item-spec">' +
            utils.escapeHtml(item.brand) + ' · ' +
            utils.escapeHtml(components.getCategoryName(item.category)) +
            ' · 单价 ¥' + utils.formatPrice(item.price) +
          '</div>' +
        '</div>' +

        '<div class="order-item-price">' +
          '<span class="qty">× ' + item.quantity + '</span>' +
          '¥' + utils.formatPrice(item.subtotal) +
        '</div>' +
      '</div>';
  }

  /* ---- 状态样式类 ---- */
  var statusClass = 'status-paid';
  if (order.status === 'PENDING') statusClass = 'status-pending';
  if (order.status === 'CANCELLED') statusClass = 'status-cancelled';

  /* ---- 备注 ---- */
  var remarkHtml = order.remark
    ? '<div class="order-remark">' +
        window.icons.icon('fileText', 14) + ' 备注：' +
        utils.escapeHtml(order.remark) + '</div>'
    : '';

  return (
    '<article class="order-card" id="order-' + utils.escapeHtml(order.id) + '">' +

      '<header class="order-card-head">' +
        '<div class="order-no">' +
          '<span>订单号</span>' +
          '<strong>' + utils.escapeHtml(order.id) + '</strong>' +
          '<span class="order-time">' + utils.formatDateTime(order.createdAt) + '</span>' +
        '</div>' +
        '<span class="order-status ' + statusClass + '">' +
          utils.escapeHtml(order.statusText || order.status) + '</span>' +
      '</header>' +

      '<div class="order-items">' + itemsHtml + '</div>' +

      remarkHtml +

      '<footer class="order-card-foot">' +
        '<div class="order-customer">' +
          /* 收货信息拆成三行独立显示。
             之前是「收货人：张三 · 13800138000」挤在一行，
             名字长一点就会和电话黏在一起，不好读也不好复制。
             拆开之后每项一行，标签左对齐，扫一眼就能找到要的信息。 */
          '<div class="customer-row">' +
            '<span class="customer-label">收货人</span>' +
            '<span class="customer-value name">' + utils.escapeHtml(order.customer.name) + '</span>' +
          '</div>' +
          '<div class="customer-row">' +
            '<span class="customer-label">联系电话</span>' +
            '<span class="customer-value phone">' + utils.escapeHtml(order.customer.phone) + '</span>' +
          '</div>' +
          '<div class="customer-row">' +
            '<span class="customer-label">收货地址</span>' +
            '<span class="customer-value">' + utils.escapeHtml(order.customer.address) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="order-total">' +
          '<span>共 ' + order.itemCount + ' 件，合计</span>' +
          '<strong>¥' + utils.formatPrice(order.totalPrice) + '</strong>' +
        '</div>' +
      '</footer>' +

    '</article>'
  );
}

/* ============================================================
   二、渲染订单列表
   ============================================================ */

function renderOrdersList(orders) {
  var container = utils.$('#ordersList');
  var sub = utils.$('#ordersSub');
  var title = utils.$('#ordersTitle');
  if (!container) return;

  // 走到这个函数时一定是已登录（未登录在 loadAllOrders 里就拦下了）
  var user = window.auth ? window.auth.getUser() : null;

  if (title) {
    title.textContent = user ? (user.nickname + ' 的订单') : '我的订单';
  }

  /* ---- 一条订单都没有 ---- */
  if (!orders || orders.length === 0) {
    if (sub) sub.textContent = '这个账号还没有订单';

    container.innerHTML =
      '<div class="orders-empty">' +
        '<div class="orders-empty-icon">' + window.icons.icon('receipt', 34) + '</div>' +
        '<h3>还没有订单</h3>' +
        '<p>去商城挑几件喜欢的商品吧</p>' +
        '<div class="orders-empty-actions">' +
          '<a class="btn btn-primary" href="./index.html#products">去逛逛</a>' +
        '</div>' +
      '</div>';
    return;
  }

  /* ---- 统计信息 ---- */
  var totalAmount = 0;
  var totalItems = 0;
  for (var i = 0; i < orders.length; i++) {
    totalAmount += Number(orders[i].totalPrice) || 0;
    totalItems += Number(orders[i].itemCount) || 0;
  }

  if (sub) {
    sub.textContent = '共 ' + orders.length + ' 笔订单';
  }

  var statsHtml =
    '<div class="orders-stats">' +
      '<div class="stat-card">' +
        '<div class="stat-value">' + orders.length + '</div>' +
        '<div class="stat-label">订单总数</div>' +
      '</div>' +
      '<div class="stat-card">' +
        '<div class="stat-value">' + totalItems + '</div>' +
        '<div class="stat-label">商品件数</div>' +
      '</div>' +
      '<div class="stat-card">' +
        '<div class="stat-value">¥' + utils.formatPrice(totalAmount) + '</div>' +
        '<div class="stat-label">消费总额</div>' +
      '</div>' +
    '</div>';

  /* ---- 订单卡片 ---- */
  var cardsHtml = '';
  for (var j = 0; j < orders.length; j++) {
    cardsHtml += orderCardHtml(orders[j]);
  }

  container.innerHTML = statsHtml + cardsHtml;
}

/* ============================================================
   三、渲染单个订单详情（带 ?id= 参数时）
   ============================================================ */

function renderSingleOrder(order) {
  var container = utils.$('#orderDetail');
  var sub = utils.$('#ordersSub');
  if (!container) return;

  var statusClass = 'status-paid';
  if (order.status === 'PENDING') statusClass = 'status-pending';
  if (order.status === 'CANCELLED') statusClass = 'status-cancelled';

  container.innerHTML =
    '<div class="order-detail-wrap">' +
      '<div class="order-card-head" style="background:transparent;border:none;padding:0 0 16px;">' +
        '<h2 class="order-detail-title">订单详情</h2>' +
        '<span class="order-status ' + statusClass + '">' +
          utils.escapeHtml(order.statusText || order.status) + '</span>' +
      '</div>' +

      '<div class="order-detail-grid">' +
        '<div class="order-detail-row">' +
          '<span class="order-detail-label">订单编号</span>' +
          '<span class="order-detail-value">' + utils.escapeHtml(order.id) + '</span>' +
        '</div>' +
        '<div class="order-detail-row">' +
          '<span class="order-detail-label">创建时间</span>' +
          '<span class="order-detail-value">' + utils.formatDateTime(order.createdAt) + '</span>' +
        '</div>' +
        '<div class="order-detail-row">' +
          '<span class="order-detail-label">商品件数</span>' +
          '<span class="order-detail-value">' + order.itemCount + ' 件</span>' +
        '</div>' +
        '<div class="order-detail-row">' +
          '<span class="order-detail-label">订单总价</span>' +
          '<span class="order-detail-value" style="color:var(--color-danger)">¥' +
            utils.formatPrice(order.totalPrice) + '</span>' +
        '</div>' +
        '<div class="order-detail-row">' +
          '<span class="order-detail-label">收货人</span>' +
          '<span class="order-detail-value">' + utils.escapeHtml(order.customer.name) + '</span>' +
        '</div>' +
        '<div class="order-detail-row">' +
          '<span class="order-detail-label">联系电话</span>' +
          '<span class="order-detail-value">' + utils.escapeHtml(order.customer.phone) + '</span>' +
        '</div>' +
        '<div class="order-detail-row">' +
          '<span class="order-detail-label">收货地址</span>' +
          '<span class="order-detail-value">' + utils.escapeHtml(order.customer.address) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<h2 class="order-detail-title" style="margin-bottom:16px;">商品清单</h2>' +
    orderCardHtml(order);

  if (sub) sub.textContent = '订单号 ' + order.id;
}

/* ============================================================
   四、加载数据
   ============================================================ */

/**
 * 加载所有订单
 */
async function loadAllOrders() {
  var container = utils.$('#ordersList');
  if (!container) return;

  /* 未登录不请求接口，直接显示登录引导。
     下单必须登录，所以不存在"游客订单"了，没必要发请求。 */
  if (!window.auth || !window.auth.isLoggedIn()) {
    renderLoggedOutState();
    return;
  }

  container.innerHTML = '<p class="loading-text">订单加载中…</p>';

  try {
    // 已登录：后端按 userId 返回「我的订单」
    var orders = await window.api.getOrders();
    renderOrdersList(orders);

  } catch (err) {
    console.error('订单加载失败：', err);

    // 401 说明登录状态失效了（token 过期或账号没了），
    // 这不是"加载失败"，应该引导重新登录
    if (err.status === 401) {
      renderLoggedOutState();
      return;
    }

    container.innerHTML =
      '<div class="orders-empty">' +
        '<div class="orders-empty-icon">' + window.icons.icon('alertCircle', 34) + '</div>' +
        '<h3>订单加载失败</h3>' +
        '<p>' + utils.escapeHtml(err.message) + '</p>' +
        '<button class="btn btn-primary" onclick="location.reload()">重新加载</button>' +
      '</div>';
  }
}

/**
 * 未登录时订单页显示的内容
 */
function renderLoggedOutState() {
  var container = utils.$('#ordersList');
  var sub = utils.$('#ordersSub');
  var title = utils.$('#ordersTitle');
  if (!container) return;

  if (title) title.textContent = '我的订单';
  if (sub) sub.textContent = '登录后查看你的订单记录';

  container.innerHTML =
    '<div class="orders-empty">' +
      '<div class="orders-empty-icon">' + window.icons.icon('user', 34) + '</div>' +
      '<h3>请先登录</h3>' +
      '<p>登录后可以查看自己的订单记录</p>' +
      '<div class="orders-empty-actions">' +
        '<button class="btn btn-primary" type="button" ' +
                'onclick="window.auth.open(\'login\')">登录 / 注册</button>' +
        '<a class="btn btn-outline" href="./index.html#products">去逛逛</a>' +
      '</div>' +
    '</div>';
}

/**
 * 加载单个订单
 */
async function loadSingleOrder(orderId) {
  var container = utils.$('#orderDetail');

  try {
    var order = await window.api.getOrder(orderId);
    renderSingleOrder(order);

    // 同时把列表也显示出来（方便用户看其它订单）
    await loadAllOrders();

    // 滚动到订单详情
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('订单查询失败：', err);
    if (container) {
      container.innerHTML =
        '<div class="orders-empty">' +
          '<div class="orders-empty-icon">' + window.icons.icon('folderSearch', 34) + '</div>' +
          '<h3>没找到这个订单</h3>' +
          '<p>订单号：' + utils.escapeHtml(orderId) + '</p>' +
          '<p>' + utils.escapeHtml(err.message) + '</p>' +
          '<a class="btn btn-primary" href="./orders.html">查看所有订单</a>' +
        '</div>';
    }
  }
}

/* ============================================================
   五、页面初始化
   ============================================================ */

async function initOrdersPage() {
  // 1. 全局交互
  cart.init();
  components.initGlobalComponents();

  /* 确认登录状态。
     会先问后端"我这个 token 对应谁"，
     然后渲染导航栏右上角的登录按钮 / 用户菜单。
     注意用了 await —— 后面的逻辑可能需要知道"是否已登录"。 */
  if (window.auth && typeof window.auth.init === 'function') {
    await window.auth.init();
  }

  if (window.agent && typeof window.agent.init === 'function') {
    window.agent.init();
  }

  /* 初始化 AI 客服（顶部入口）。
     必须放在 agent.init() 之后，因为它要用 agent.tools 里的工具函数
     （搜索商品、加购物车），那些是在 agent.js 加载时就绪的。 */
  if (window.support && typeof window.support.init === 'function') {
    window.support.init();
  }

  /* ---- 搜索框：跳到搜索结果页 ---- */
  var searchForm = utils.$('#searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var keyword = (utils.$('#searchInput').value || '').trim();
      if (!keyword) {
        utils.toast('请输入要搜索的内容', 'info');
        return;
      }
      utils.goToSearchPage(keyword);
    });
  }

  /* ---- 2. 判断是列表模式还是单个订单模式 ---- */
  var orderId = utils.getUrlParam('id');

  if (orderId) {
    await loadSingleOrder(orderId);
  } else {
    await loadAllOrders();
  }
}

/* ============================================================
   六、给 auth.js 用的钩子
   ------------------------------------------------------------
   登录或退出之后，订单列表要跟着变：
   登录 → 显示这个账号的订单
   退出 → 回到"请先登录"的引导

   auth.js 里判断了这个函数存不存在再调用，
   所以在其它页面（首页、详情页）不会报错。
   ============================================================ */

window.refreshOrdersAfterAuth = function () {
  // 只重新拉订单列表，不动顶部的单笔详情
  if (utils.$('#ordersList')) {
    loadAllOrders();
  }
};

document.addEventListener('DOMContentLoaded', initOrdersPage);
