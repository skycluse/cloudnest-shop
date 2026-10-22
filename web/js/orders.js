/* ============================================================
   orders.js —— 订单页逻辑
   ------------------------------------------------------------
   两种模式：
   1. orders.html          → 显示所有订单列表
   2. orders.html?id=xxx   → 高亮显示某一个订单的详情
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
  if (!container) return;

  /* ---- 一条订单都没有 ---- */
  if (!orders || orders.length === 0) {
    if (sub) sub.textContent = '还没有任何订单';
    container.innerHTML =
      '<div class="orders-empty">' +
        '<div class="orders-empty-icon">' + window.icons.icon('receipt', 34) + '</div>' +
        '<h3>还没有订单</h3>' +
        '<p>去商城挑几件喜欢的商品吧</p>' +
        '<a class="btn btn-primary" href="./index.html#products">去逛逛</a>' +
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
  if (container) container.innerHTML = '<p class="loading-text">订单加载中…</p>';

  try {
    var orders = await window.api.getOrders();
    renderOrdersList(orders);

  } catch (err) {
    console.error('订单加载失败：', err);
    if (container) {
      container.innerHTML =
        '<div class="orders-empty">' +
          '<div class="orders-empty-icon">' + window.icons.icon('alertCircle', 34) + '</div>' +
          '<h3>订单加载失败</h3>' +
          '<p>' + utils.escapeHtml(err.message) + '</p>' +
          '<button class="btn btn-primary" onclick="location.reload()">重新加载</button>' +
        '</div>';
    }
  }
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

  if (window.agent && typeof window.agent.init === 'function') {
    window.agent.init();
  }

  /* ---- 搜索框：跳到首页搜索 ---- */
  var searchForm = utils.$('#searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var keyword = (utils.$('#searchInput').value || '').trim();
      if (!keyword) return;
      window.location.href = './index.html?keyword=' + encodeURIComponent(keyword);
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

document.addEventListener('DOMContentLoaded', initOrdersPage);
