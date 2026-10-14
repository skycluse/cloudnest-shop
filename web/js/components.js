/* ============================================================
   components.js —— 可复用的界面组件
   ------------------------------------------------------------
   这里做的事：拿到数据 → 拼出 HTML 字符串 → 塞进页面
   这种写法叫"字符串模板"，是没有框架时最直观的做法。

   另一种做法是 createElement 一个个建元素，代码会长很多。
   两种都可以，这里选字符串是因为更好读、更好改。
   ============================================================ */

/* ============================================================
   一、商品卡片
   ============================================================ */

/**
 * 根据一个商品对象，生成一张卡片的 HTML。
 *
 * @param {object} product 商品数据
 * @param {object} options { showAddButton: 是否显示"加入购物车"按钮 }
 * @returns {string} HTML 字符串
 */
function productCardHtml(product, options) {
  var opts = options || {};
  var showAdd = opts.showAddButton !== false;

  var stockInfo = utils.getStockInfo(product.stock);
  var soldOut = !stockInfo.available;

  // 分类名：因为商品数据里只有分类 id，这里做个小映射
  var categoryName = getCategoryName(product.category);

  // 只显示前 3 个标签，多了卡片会很乱
  var tags = (product.tags || []).slice(0, 3);
  var tagsHtml = '';
  for (var i = 0; i < tags.length; i++) {
    tagsHtml += '<span class="tag">' + utils.escapeHtml(tags[i]) + '</span>';
  }

  // 售罄时按钮禁用
  var addButtonHtml = '';
  if (showAdd) {
    if (soldOut) {
      addButtonHtml = '<button class="btn btn-ghost btn-sm btn-add" disabled>已售罄</button>';
    } else {
      addButtonHtml =
        '<button class="btn btn-primary btn-sm btn-add" data-add-cart="' + product.id + '">' +
        '加入购物车</button>';
    }
  }

  return (
    '<article class="product-card" data-product-id="' + product.id + '">' +
      '<a class="card-link" href="./product.html?id=' + product.id + '" title="查看详情">' +
        '<div class="product-thumb">' +
          '<img src="' + utils.escapeHtml(product.image) + '" alt="' + utils.escapeHtml(product.name) + '" loading="lazy" />' +
          '<span class="product-cat-tag">' + utils.escapeHtml(categoryName) + '</span>' +
          (soldOut ? '<div class="product-sold-out">已售罄</div>' : '') +
        '</div>' +
      '</a>' +

      '<div class="product-body">' +
        '<a class="card-link" href="./product.html?id=' + product.id + '">' +
          '<h3 class="product-name">' + utils.escapeHtml(product.name) + '</h3>' +
        '</a>' +

        '<p class="product-tagline">' + utils.escapeHtml(product.tagline) + '</p>' +

        '<div class="product-tags">' + tagsHtml + '</div>' +

        '<div class="product-meta">' +
          '<span class="product-price"><span class="unit">¥</span>' + utils.formatPrice(product.price) + '</span>' +
          '<span class="product-rating">' + utils.renderStars(product.rating) + ' ' + product.rating + '</span>' +
        '</div>' +

        addButtonHtml +
      '</div>' +
    '</article>'
  );
}

/**
 * 渲染商品列表到指定的容器里。
 *
 * @param {Element|string} container 容器元素或选择器
 * @param {Array} products 商品数组
 * @param {string} emptyMessage 没有商品时显示什么
 */
function renderProductGrid(container, products, emptyMessage) {
  var el = typeof container === 'string' ? utils.$(container) : container;
  if (!el) return;

  // 空结果要有友好提示，不能一片空白
  if (!products || products.length === 0) {
    el.innerHTML =
      '<div class="empty-text">' +
        '<div style="font-size:40px;margin-bottom:8px;">🔍</div>' +
        utils.escapeHtml(emptyMessage || '没有找到相关商品') +
      '</div>';
    return;
  }

  // 先把所有卡片的 HTML 拼成一个大字符串，最后一次性塞进去。
  // 这样只触发一次页面重排，比一个个 append 快很多。
  var html = '';
  for (var i = 0; i < products.length; i++) {
    html += productCardHtml(products[i]);
  }
  el.innerHTML = html;
}

/* ============================================================
   二、分类名称映射
   ------------------------------------------------------------
   商品数据里 category 存的是 id（如 'audio'），
   显示时要变成中文名（'耳机音频'）。
   ============================================================ */

var CATEGORY_NAMES = {
  audio: '耳机音频',
  keyboard: '键盘外设',
  mouse: '鼠标',
  power: '充电储能',
  smart: '智能家居',
  accessory: '配件周边'
};

function getCategoryName(categoryId) {
  return CATEGORY_NAMES[categoryId] || '其它';
}

/**
 * 渲染分类卡片到容器里
 * @param {Array} categories 后端返回的分类数组
 * @param {string} activeId 当前选中的分类 id
 */
function renderCategoryGrid(container, categories, activeId) {
  var el = typeof container === 'string' ? utils.$(container) : container;
  if (!el) return;

  var html = '';
  for (var i = 0; i < categories.length; i++) {
    var c = categories[i];
    var isActive = activeId && activeId === c.id;
    html +=
      '<button class="category-card' + (isActive ? ' is-active' : '') + '" ' +
              'type="button" data-category="' + utils.escapeHtml(c.id) + '">' +
        '<span class="category-icon">' + c.icon + '</span>' +
        '<span class="category-name">' + utils.escapeHtml(c.name) + '</span>' +
        '<span class="category-count">' + c.count + ' 件</span>' +
      '</button>';
  }
  el.innerHTML = html;
}

/* ============================================================
   三、侧拉购物车
   ============================================================ */

/**
 * 打开侧拉购物车
 */
function openCartDrawer() {
  var drawer = utils.$('#cartDrawer');
  var mask = utils.$('#drawerMask');
  if (!drawer) return;

  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  if (mask) mask.hidden = false;

  // 打开时锁住 body 滚动，防止背景页面跟着滚
  document.body.style.overflow = 'hidden';
}

/**
 * 关闭侧拉购物车
 */
function closeCartDrawer() {
  var drawer = utils.$('#cartDrawer');
  var mask = utils.$('#drawerMask');
  if (!drawer) return;

  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  if (mask) mask.hidden = true;

  document.body.style.overflow = '';
}

/**
 * 把购物车内容渲染出来。
 * 这是 cart.subscribe() 的回调：购物车一变就会被调用。
 */
function renderCartDrawer() {
  var body = utils.$('#cartBody');
  var badge = utils.$('#cartBadge');
  var totalEl = utils.$('#cartTotal');
  var countEl = utils.$('#cartDrawerCount');
  if (!body) return;

  var items = cart.getItems();
  var totalCount = cart.getTotalCount();
  var totalPrice = cart.getTotalPrice();

  /* ---- 顶部角标 ---- */
  if (badge) {
    if (totalCount > 0) {
      badge.hidden = false;
      badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
    } else {
      badge.hidden = true;
    }
  }

  /* ---- 标题上的数量 ---- */
  if (countEl) countEl.textContent = '(' + totalCount + ')';

  /* ---- 合计金额 ---- */
  if (totalEl) totalEl.textContent = utils.formatPriceCny(totalPrice);

  /* ---- 商品列表 ---- */
  if (items.length === 0) {
    body.innerHTML =
      '<div class="cart-empty">' +
        '<div class="cart-empty-icon">🛒</div>' +
        '<p>购物车还是空的</p>' +
        '<button class="btn btn-primary btn-sm" type="button" data-goto-products>去逛逛</button>' +
      '</div>';
    updateCheckoutButtons(false);
    return;
  }

  var html = '';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var subtotal = cart.getItemSubtotal(item);

    // 减号在数量为 1 时仍然可点（点了就删除），这是常见交互
    html +=
      '<div class="cart-item" data-cart-item="' + item.productId + '">' +
        '<a href="./product.html?id=' + item.productId + '">' +
          '<img class="cart-item-img" src="' + utils.escapeHtml(item.image) + '" ' +
               'alt="' + utils.escapeHtml(item.name) + '" loading="lazy" />' +
        '</a>' +

        '<div class="cart-item-main">' +
          '<a href="./product.html?id=' + item.productId + '">' +
            '<div class="cart-item-name">' + utils.escapeHtml(item.name) + '</div>' +
          '</a>' +

          '<div class="cart-item-bottom">' +
            '<div class="qty-stepper">' +
              '<button class="qty-btn" type="button" data-qty-minus="' + item.productId + '" ' +
                      'aria-label="减少数量">−</button>' +
              '<span class="qty-value">' + item.quantity + '</span>' +
              '<button class="qty-btn" type="button" data-qty-plus="' + item.productId + '" ' +
                      'aria-label="增加数量"' + (item.quantity >= item.stock ? ' disabled' : '') + '>+</button>' +
            '</div>' +
            '<span class="cart-item-price">' + utils.formatPriceCny(subtotal) + '</span>' +
          '</div>' +

          '<button class="cart-item-remove" type="button" data-remove="' + item.productId + '">' +
            '删除</button>' +
        '</div>' +
      '</div>';
  }

  body.innerHTML = html;
  updateCheckoutButtons(true);
}

/**
 * 根据购物车是否为空，启用/禁用底部按钮
 */
function updateCheckoutButtons(enabled) {
  var checkoutBtn = utils.$('#cartCheckout');
  var clearBtn = utils.$('#cartClear');
  if (checkoutBtn) checkoutBtn.disabled = !enabled;
  if (clearBtn) clearBtn.disabled = !enabled;
}

/* ============================================================
   四、结算弹窗
   ============================================================ */

function openCheckout() {
  if (cart.isEmpty()) {
    utils.toast('购物车是空的，先挑点东西吧', 'error');
    return;
  }

  var mask = utils.$('#checkoutMask');
  if (!mask) return;

  mask.hidden = false;
  document.body.style.overflow = 'hidden';
  renderCheckoutSummary();

  // 自动聚焦到第一个输入框，省用户一次点击
  var nameInput = utils.$('#ckName');
  if (nameInput) {
    setTimeout(function () { nameInput.focus(); }, 100);
  }
}

function closeCheckout() {
  var mask = utils.$('#checkoutMask');
  if (!mask) return;
  mask.hidden = true;
  document.body.style.overflow = '';

  // 清掉上一次的错误提示
  clearCheckoutErrors();
}

/**
 * 渲染结算弹窗里的订单摘要
 */
function renderCheckoutSummary() {
  var el = utils.$('#checkoutSummary');
  if (!el) return;

  var items = cart.getItems();
  var html = '';

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    html +=
      '<div class="row">' +
        '<span>' + utils.escapeHtml(item.name) + ' × ' + item.quantity + '</span>' +
        '<span>' + utils.formatPriceCny(cart.getItemSubtotal(item)) + '</span>' +
      '</div>';
  }

  html +=
    '<div class="row total">' +
      '<span>应付总额</span>' +
      '<span class="amount">' + utils.formatPriceCny(cart.getTotalPrice()) + '</span>' +
    '</div>';

  el.innerHTML = html;
}

/**
 * 清空所有表单错误提示
 */
function clearCheckoutErrors() {
  var ids = ['errName', 'errPhone', 'errAddress', 'errGlobal'];
  for (var i = 0; i < ids.length; i++) {
    var el = utils.$('#' + ids[i]);
    if (el) el.textContent = '';
  }
  utils.$$('.form-input').forEach(function (input) {
    input.classList.remove('is-invalid');
  });
}

/**
 * 显示某个字段的错误
 */
function showFieldError(fieldId, errorId, message) {
  var field = utils.$('#' + fieldId);
  var error = utils.$('#' + errorId);
  if (field) field.classList.add('is-invalid');
  if (error) error.textContent = message;
}

/**
 * 校验结算表单。
 * 前端校验的目的不是安全（安全必须靠后端），而是给用户即时反馈。
 * 后端 store.js 里同样的规则还会再查一遍 —— 这叫"双重校验"。
 *
 * @returns {object|null} 校验通过返回 null，否则返回错误信息对象
 */
function validateCheckoutForm() {
  clearCheckoutErrors();

  var name = (utils.$('#ckName').value || '').trim();
  var phone = (utils.$('#ckPhone').value || '').trim();
  var address = (utils.$('#ckAddress').value || '').trim();

  var hasError = false;

  if (!name) {
    showFieldError('ckName', 'errName', '请填写收货人姓名');
    hasError = true;
  } else if (name.length > 20) {
    showFieldError('ckName', 'errName', '姓名不能超过 20 个字');
    hasError = true;
  }

  if (!phone) {
    showFieldError('ckPhone', 'errPhone', '请填写手机号');
    hasError = true;
  } else if (!/^1[3-9]\d{9}$/.test(phone)) {
    showFieldError('ckPhone', 'errPhone', '手机号格式不正确（应为 1 开头的 11 位数字）');
    hasError = true;
  }

  if (!address) {
    showFieldError('ckAddress', 'errAddress', '请填写收货地址');
    hasError = true;
  } else if (address.length < 5) {
    showFieldError('ckAddress', 'errAddress', '地址太短了，请填写详细地址');
    hasError = true;
  }

  if (hasError) return { name: name, phone: phone, address: address, invalid: true };
  return null;
}

/* ============================================================
   五、提交订单
   ============================================================ */

var isSubmittingOrder = false;   // 防止用户狂点按钮重复下单

/**
 * 提交订单的完整流程：
 *   1. 前端校验表单
 *   2. 调后端 POST /api/orders
 *   3. 成功后清空购物车、显示结果弹窗
 *   4. 失败时把后端的报错展示给用户
 */
async function submitOrder() {
  if (isSubmittingOrder) return;

  // ---- 1. 校验 ----
  var invalid = validateCheckoutForm();
  if (invalid) {
    utils.toast('请检查表单填写', 'error');
    return;
  }

  var name = utils.$('#ckName').value.trim();
  var phone = utils.$('#ckPhone').value.trim();
  var address = utils.$('#ckAddress').value.trim();
  var remark = (utils.$('#ckRemark').value || '').trim();

  var submitBtn = utils.$('#checkoutSubmit');
  var originalText = submitBtn ? submitBtn.textContent : '';

  isSubmittingOrder = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
  }

  try {
    // ---- 2. 请求后端 ----
    var order = await window.api.createOrder({
      items: cart.toOrderItems(),
      customer: { name: name, phone: phone, address: address },
      remark: remark
    });

    // ---- 3. 成功 ----
    cart.clear();                 // 清空购物车
    closeCheckout();
    closeCartDrawer();
    showOrderResult(order);

  } catch (err) {
    // ---- 4. 失败：把后端的提示显示出来 ----
    console.error('下单失败：', err);

    var globalError = utils.$('#errGlobal');
    if (globalError) globalError.textContent = err.message;

    // 【调试能力体现】后端说库存不足时，主动去拉最新库存刷新界面，
    // 这样用户看到的数字就是对的，而不是"我明明看到有货啊"
    if (err.message && err.message.indexOf('库存') !== -1) {
      await syncCartStock();
    }

    utils.toast(err.message, 'error');

  } finally {
    // finally 里的代码无论成功失败都会执行，用来收尾最合适
    isSubmittingOrder = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

/**
 * 用后端的真实数据刷新购物车里所有商品的库存。
 */
async function syncCartStock() {
  var items = cart.getItems();

  for (var i = 0; i < items.length; i++) {
    try {
      // await 让请求一个接一个发，简单可靠
      var product = await window.api.getProduct(items[i].productId);
      cart.refreshStock(product);
    } catch (err) {
      // 商品可能已经下架（404），忽略它，继续处理下一个
      console.warn('刷新库存失败：', items[i].productId, err.message);
    }
  }
}

/* ============================================================
   六、下单结果弹窗
   ============================================================ */

function showOrderResult(order) {
  var mask = utils.$('#resultMask');
  var info = utils.$('#resultInfo');
  if (!mask || !info) return;

  info.innerHTML =
    '<div class="row"><span>订单编号</span><span>' + utils.escapeHtml(order.id) + '</span></div>' +
    '<div class="row"><span>商品件数</span><span>' + order.itemCount + ' 件</span></div>' +
    '<div class="row"><span>订单总价</span><span>' + utils.formatPriceCny(order.totalPrice) + '</span></div>' +
    '<div class="row"><span>创建时间</span><span>' + utils.formatDateTime(order.createdAt) + '</span></div>' +
    '<div class="row"><span>订单状态</span><span>' + utils.escapeHtml(order.statusText) + '</span></div>' +
    '<div class="row"><span>收货人</span><span>' + utils.escapeHtml(order.customer.name) +
      ' ' + utils.escapeHtml(order.customer.phone) + '</span></div>';

  var viewBtn = utils.$('#resultViewOrder');
  if (viewBtn) viewBtn.href = './orders.html?id=' + encodeURIComponent(order.id);

  mask.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeOrderResult() {
  var mask = utils.$('#resultMask');
  if (!mask) return;
  mask.hidden = true;
  document.body.style.overflow = '';
}

/* ============================================================
   七、全局事件绑定
   ------------------------------------------------------------
   这些事件在所有页面都要生效，所以放在这里统一绑定。
   ============================================================ */

function initGlobalComponents() {
  /* ---------- 购物车抽屉 ---------- */
  var cartTrigger = utils.$('#cartTrigger');
  if (cartTrigger) cartTrigger.addEventListener('click', openCartDrawer);

  var cartClose = utils.$('#cartClose');
  if (cartClose) cartClose.addEventListener('click', closeCartDrawer);

  var drawerMask = utils.$('#drawerMask');
  if (drawerMask) drawerMask.addEventListener('click', closeCartDrawer);

  /* ---------- 购物车内的操作 ----------
     这里用了"事件委托"：
     不给每个按钮单独绑定事件（因为商品会动态变化，绑了也会失效），
     而是把事件绑在容器上，点击时再看看到底点的是哪个按钮。
     这样无论购物车里怎么变化，事件永远有效。
  */
  var cartBody = utils.$('#cartBody');
  if (cartBody) {
    cartBody.addEventListener('click', function (event) {
      var target = event.target;

      // closest 会往上找最近的匹配元素（因为按钮里可能有 <span>）
      var plusBtn = target.closest('[data-qty-plus]');
      var minusBtn = target.closest('[data-qty-minus]');
      var removeBtn = target.closest('[data-remove]');
      var gotoBtn = target.closest('[data-goto-products]');

      if (plusBtn) {
        var plusResult = cart.increase(plusBtn.getAttribute('data-qty-plus'));
        if (!plusResult.ok) utils.toast(plusResult.message, 'error');
        return;
      }

      if (minusBtn) {
        var minusResult = cart.decrease(minusBtn.getAttribute('data-qty-minus'));
        if (!minusResult.ok) utils.toast(minusResult.message, 'error');
        return;
      }

      if (removeBtn) {
        var removeResult = cart.remove(removeBtn.getAttribute('data-remove'));
        if (removeResult.ok) utils.toast('已删除', 'success');
        return;
      }

      if (gotoBtn) {
        closeCartDrawer();
        utils.scrollToElement('#products');
      }
    });
  }

  /* ---------- 清空购物车 ---------- */
  var cartClear = utils.$('#cartClear');
  if (cartClear) {
    cartClear.addEventListener('click', function () {
      if (cart.isEmpty()) return;
      // confirm 会弹一个系统确认框，防止误操作
      if (window.confirm('确定要清空购物车吗？')) {
        cart.clear();
        utils.toast('购物车已清空', 'success');
      }
    });
  }

  /* ---------- 去结算 ---------- */
  var cartCheckout = utils.$('#cartCheckout');
  if (cartCheckout) {
    cartCheckout.addEventListener('click', function () {
      closeCartDrawer();
      openCheckout();
    });
  }

  /* ---------- 结算弹窗 ---------- */
  var checkoutClose = utils.$('#checkoutClose');
  if (checkoutClose) checkoutClose.addEventListener('click', closeCheckout);

  var checkoutCancel = utils.$('#checkoutCancel');
  if (checkoutCancel) checkoutCancel.addEventListener('click', closeCheckout);

  var checkoutMask = utils.$('#checkoutMask');
  if (checkoutMask) {
    checkoutMask.addEventListener('click', function (event) {
      // 只有点到遮罩本身才关闭，点弹窗内部不关
      if (event.target === checkoutMask) closeCheckout();
    });
  }

  var checkoutSubmit = utils.$('#checkoutSubmit');
  if (checkoutSubmit) checkoutSubmit.addEventListener('click', submitOrder);

  /* ---------- 下单结果弹窗 ---------- */
  var resultContinue = utils.$('#resultContinue');
  if (resultContinue) resultContinue.addEventListener('click', closeOrderResult);

  var resultMask = utils.$('#resultMask');
  if (resultMask) {
    resultMask.addEventListener('click', function (event) {
      if (event.target === resultMask) closeOrderResult();
    });
  }

  /* ---------- 键盘：按 Esc 关闭所有浮层 ---------- */
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    closeCartDrawer();
    closeCheckout();
    closeOrderResult();
    if (window.agent && typeof window.agent.close === 'function') {
      window.agent.close();
    }
  });

  /* ---------- 顶部导航栏滚动阴影 ---------- */
  var header = utils.$('#siteHeader');
  if (header) {
    var onScroll = utils.throttle(function () {
      if (window.pageYOffset > 8) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }, 100);

    window.addEventListener('scroll', onScroll);
    onScroll();   // 页面可能是刷新后停在中间的，先执行一次
  }

  /* ---------- 商品卡片上的"加入购物车"按钮 ----------
     同样用事件委托。但有个坑：
     委托绑在 document 上，页面上所有 [data-add-cart] 都能被捕获，
     包括首页商品列表的，也包括 AI 助手推荐卡片里的。
  */
  document.addEventListener('click', async function (event) {
    var btn = event.target.closest('[data-add-cart]');
    if (!btn) return;

    event.preventDefault();

    var productId = btn.getAttribute('data-add-cart');
    await addProductToCartById(productId, btn);
  });

  /* ---------- 订阅购物车变化 ---------- */
  cart.subscribe(renderCartDrawer);
}

/**
 * 按商品 id 加入购物车。
 * 为什么要重新请求一次商品详情？
 * 因为前端存的商品信息可能过时了（价格变了、库存少了），
 * 加购前问一下后端是最稳的做法。真实项目都会这么做。
 *
 * @param {number|string} productId
 * @param {Element} btn 触发按钮，用来做 loading 状态
 */
async function addProductToCartById(productId, btn) {
  var originalText = btn ? btn.textContent : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = '添加中…';
  }

  try {
    var product = await window.api.getProduct(productId);
    var result = cart.add(product, 1);

    if (result.ok) {
      utils.toast('已加入购物车 ✓', 'success');
      // 加购后自动打开购物车，用户能立刻看到结果
      openCartDrawer();
    } else {
      utils.toast(result.message, 'error');
    }

  } catch (err) {
    utils.toast(err.message, 'error');

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

// 挂到 window
window.components = {
  productCardHtml: productCardHtml,
  renderProductGrid: renderProductGrid,
  renderCategoryGrid: renderCategoryGrid,
  getCategoryName: getCategoryName,
  openCartDrawer: openCartDrawer,
  closeCartDrawer: closeCartDrawer,
  renderCartDrawer: renderCartDrawer,
  openCheckout: openCheckout,
  closeCheckout: closeCheckout,
  showOrderResult: showOrderResult,
  closeOrderResult: closeOrderResult,
  initGlobalComponents: initGlobalComponents,
  addProductToCartById: addProductToCartById
};
