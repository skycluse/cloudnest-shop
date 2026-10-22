/* ============================================================
   product.js —— 商品详情页逻辑
   ------------------------------------------------------------
   需要展示：商品名称、图片、价格、介绍、分类、库存状态、加入购物车按钮
   ============================================================ */

// 当前页面展示的商品
var currentProduct = null;

// 用户选的要买的数量
var detailQuantity = 1;

/* ============================================================
   一、从地址栏拿商品 id
   ------------------------------------------------------------
   详情页的地址长这样：product.html?id=3
   商品列表点进来时会带上 id，这里把它读出来。
   ============================================================ */

function getProductIdFromUrl() {
  return utils.getUrlParam('id');
}

/* ============================================================
   二、渲染详情
   ============================================================ */

function renderProductDetail(product) {
  var container = utils.$('#productDetail');
  if (!container) return;

  var stockInfo = utils.getStockInfo(product.stock);
  var categoryName = components.getCategoryName(product.category);
  var soldOut = !stockInfo.available;

  /* ---- 标签 ---- */
  var tagsHtml = '';
  for (var i = 0; i < (product.tags || []).length; i++) {
    tagsHtml +=
      '<span class="tag" data-tag="' + utils.escapeHtml(product.tags[i]) + '">' +
        utils.escapeHtml(product.tags[i]) +
      '</span>';
  }

  /* ---- 规格参数表 ---- */
  var specsHtml = '';
  var specs = product.specs || {};
  var specKeys = Object.keys(specs);
  for (var k = 0; k < specKeys.length; k++) {
    specsHtml +=
      '<tr>' +
        '<th>' + utils.escapeHtml(specKeys[k]) + '</th>' +
        '<td>' + utils.escapeHtml(specs[specKeys[k]]) + '</td>' +
      '</tr>';
  }

  /* ---- 购买按钮 ---- */
  var buyButtonsHtml = '';
  if (soldOut) {
    buyButtonsHtml =
      '<button class="btn btn-ghost" disabled>已售罄</button>' +
      '<button class="btn btn-ghost" disabled>暂时无法购买</button>';
  } else {
    buyButtonsHtml =
      '<button class="btn btn-outline" id="detailAddCart" type="button">' +
        window.icons.icon('shoppingCart', 17) + ' 加入购物车</button>' +
      '<button class="btn btn-primary" id="detailBuyNow" type="button">立即购买</button>';
  }

  /* ---- 数量步进器 ---- */
  var qtyStepperHtml = '';
  if (!soldOut) {
    qtyStepperHtml =
      '<div class="detail-buy-row">' +
        '<span class="detail-qty-label">购买数量</span>' +
        '<div class="qty-stepper">' +
          '<button class="qty-btn" type="button" id="detailQtyMinus" aria-label="减少">−</button>' +
          '<span class="qty-value" id="detailQtyValue">1</span>' +
          '<button class="qty-btn" type="button" id="detailQtyPlus" aria-label="增加">+</button>' +
        '</div>' +
        '<span class="detail-qty-label">库存 ' + product.stock + ' 件</span>' +
      '</div>';
  }

  container.innerHTML =
    '<div class="detail-wrap">' +

      /* ===== 左：图片 ===== */
      '<div class="detail-gallery">' +
        '<div class="detail-image-box">' +
          '<img src="' + utils.escapeHtml(product.image) + '" alt="' +
               utils.escapeHtml(product.name) + '" />' +
          (soldOut ? '<div class="product-sold-out">已售罄</div>' : '') +
        '</div>' +
      '</div>' +

      /* ===== 右：信息 ===== */
      '<div class="detail-info">' +
        '<div class="detail-brand">' +
          '<span class="brand-badge">' + utils.escapeHtml(product.brand) + '</span>' +
          '<span>云巢商城自营</span>' +
        '</div>' +

        '<h1 class="detail-title">' + utils.escapeHtml(product.name) + '</h1>' +
        '<p class="detail-tagline">' + utils.escapeHtml(product.tagline) + '</p>' +

        '<div class="detail-price-box">' +
          '<span class="detail-price"><span class="unit">¥</span>' +
            utils.formatPrice(product.price) + '</span>' +
          '<span class="detail-rating">' +
            utils.renderStars(product.rating) + ' ' +
            product.rating + ' 分' +
          '</span>' +
        '</div>' +

        '<div class="detail-meta-list">' +
          '<div class="detail-meta-row">' +
            '<span class="detail-meta-label">商品分类</span>' +
            '<span class="detail-meta-value">' + utils.escapeHtml(categoryName) + '</span>' +
          '</div>' +
          '<div class="detail-meta-row">' +
            '<span class="detail-meta-label">品牌</span>' +
            '<span class="detail-meta-value">' + utils.escapeHtml(product.brand) + '</span>' +
          '</div>' +
          '<div class="detail-meta-row">' +
            '<span class="detail-meta-label">库存状态</span>' +
            '<span class="detail-meta-value ' + stockInfo.cls + '">' +
              stockInfo.text + '（' + product.stock + ' 件）</span>' +
          '</div>' +
          '<div class="detail-meta-row">' +
            '<span class="detail-meta-label">商品编号</span>' +
            '<span class="detail-meta-value">CN-' + String(product.id).padStart(4, '0') + '</span>' +
          '</div>' +
        '</div>' +

        qtyStepperHtml +

        '<div class="detail-buy-actions">' + buyButtonsHtml + '</div>' +

        '<div class="detail-services">' +
          '<span class="detail-service">' + window.icons.icon('shieldCheck', 15) + ' 正品保障</span>' +
          '<span class="detail-service">' + window.icons.icon('truck', 15) + ' 48 小时内发货</span>' +
          '<span class="detail-service">' + window.icons.icon('rotateCcw', 15) + ' 7 天无理由退换</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* ===== 下方：详细介绍 / 规格 / 标签 ===== */
    '<div class="detail-tabs">' +
      '<section class="detail-section">' +
        '<h2 class="detail-section-title">商品介绍</h2>' +
        '<p class="detail-desc-text">' + utils.escapeHtml(product.desc) + '</p>' +
      '</section>' +

      (specsHtml
        ? '<section class="detail-section">' +
            '<h2 class="detail-section-title">规格参数</h2>' +
            '<table class="spec-table"><tbody>' + specsHtml + '</tbody></table>' +
          '</section>'
        : '') +

      (tagsHtml
        ? '<section class="detail-section">' +
            '<h2 class="detail-section-title">相关标签</h2>' +
            '<div class="detail-tag-cloud">' + tagsHtml + '</div>' +
          '</section>'
        : '') +
    '</div>';

  /* ---- 更新面包屑和页面标题 ---- */
  var crumbCategory = utils.$('#crumbCategory');
  if (crumbCategory) {
    crumbCategory.textContent = categoryName;
    crumbCategory.href = './index.html?category=' + encodeURIComponent(product.category);
  }

  var crumbName = utils.$('#crumbName');
  if (crumbName) crumbName.textContent = product.name;

  document.title = product.name + ' · 云巢商城';

  /* ---- 绑定这一页专属的事件 ---- */
  bindDetailEvents(product);
}

/**
 * 绑定详情页上的按钮事件
 */
function bindDetailEvents(product) {
  var qtyValueEl = utils.$('#detailQtyValue');
  var minusBtn = utils.$('#detailQtyMinus');
  var plusBtn = utils.$('#detailQtyPlus');

  /* ---- 数量 -1 ---- */
  if (minusBtn) {
    minusBtn.addEventListener('click', function () {
      if (detailQuantity <= 1) return;
      detailQuantity--;
      if (qtyValueEl) qtyValueEl.textContent = detailQuantity;
      updateDetailQtyButtons(product);
    });
  }

  /* ---- 数量 +1 ---- */
  if (plusBtn) {
    plusBtn.addEventListener('click', function () {
      if (detailQuantity >= product.stock) {
        utils.toast('已达库存上限', 'error');
        return;
      }
      detailQuantity++;
      if (qtyValueEl) qtyValueEl.textContent = detailQuantity;
      updateDetailQtyButtons(product);
    });
  }

  /* ---- 加入购物车 ---- */
  var addCartBtn = utils.$('#detailAddCart');
  if (addCartBtn) {
    addCartBtn.addEventListener('click', async function () {
      addCartBtn.disabled = true;
      var originalText = addCartBtn.textContent;
      addCartBtn.textContent = '添加中…';

      try {
        // 重新拉一次最新商品数据（价格库存可能已经变了）
        var fresh = await window.api.getProduct(product.id);
        var result = cart.add(fresh, detailQuantity);

        if (result.ok) {
          utils.toast('已加入购物车 ' + detailQuantity + ' 件', 'success');
          components.openCartDrawer();
        } else {
          utils.toast(result.message, 'error');
        }
      } catch (err) {
        utils.toast(err.message, 'error');
      } finally {
        addCartBtn.disabled = false;
        addCartBtn.textContent = originalText;
      }
    });
  }

  /* ---- 立即购买：加购后直接打开结算弹窗 ---- */
  var buyNowBtn = utils.$('#detailBuyNow');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', async function () {
      buyNowBtn.disabled = true;
      var originalText = buyNowBtn.textContent;
      buyNowBtn.textContent = '处理中…';

      try {
        var fresh2 = await window.api.getProduct(product.id);
        var result2 = cart.add(fresh2, detailQuantity);

        if (result2.ok) {
          components.openCheckout();
        } else {
          utils.toast(result2.message, 'error');
        }
      } catch (err) {
        utils.toast(err.message, 'error');
      } finally {
        buyNowBtn.disabled = false;
        buyNowBtn.textContent = originalText;
      }
    });
  }

  /* ---- 标签点击 = 用这个标签去搜索 ---- */
  var tagCloud = utils.$('.detail-tag-cloud');
  if (tagCloud) {
    tagCloud.addEventListener('click', function (event) {
      var tag = event.target.closest('[data-tag]');
      if (!tag) return;
      var keyword = tag.getAttribute('data-tag');
      window.location.href = './index.html?keyword=' + encodeURIComponent(keyword);
    });
  }
}

/**
 * 根据当前数量，决定 +/- 按钮是否禁用
 */
function updateDetailQtyButtons(product) {
  var minusBtn = utils.$('#detailQtyMinus');
  var plusBtn = utils.$('#detailQtyPlus');

  if (minusBtn) minusBtn.disabled = detailQuantity <= 1;
  if (plusBtn) plusBtn.disabled = detailQuantity >= product.stock;
}

/* ============================================================
   三、加载同类商品推荐
   ============================================================ */

async function loadRelatedProducts(product) {
  var section = utils.$('#relatedSection');
  var grid = utils.$('#relatedGrid');
  if (!section || !grid) return;

  try {
    var result = await window.api.getProducts({
      category: product.category,
      pageSize: 5,
      sort: 'rating'
    });

    // 把自己从推荐里去掉（推荐同类，但不用推荐同一个）
    var others = result.items.filter(function (p) {
      return p.id !== product.id;
    }).slice(0, 4);

    // 同类商品不够 4 个就不显示这个区块了
    if (others.length === 0) {
      section.hidden = true;
      return;
    }

    components.renderProductGrid(grid, others);
    section.hidden = false;

  } catch (err) {
    console.warn('同类推荐加载失败：', err);
    section.hidden = true;
  }
}

/* ============================================================
   四、错误处理
   ============================================================ */

function renderDetailError(message) {
  var container = utils.$('#productDetail');
  if (!container) return;

  container.innerHTML =
    '<div class="detail-error">' +
      '<div class="detail-error-icon">' + window.icons.icon('alertCircle', 48) + '</div>' +
      '<h2>商品加载失败</h2>' +
      '<p>' + utils.escapeHtml(message) + '</p>' +
      '<a class="btn btn-primary" href="./index.html#products">返回商品列表</a>' +
    '</div>';

  var crumbName = utils.$('#crumbName');
  if (crumbName) crumbName.textContent = '加载失败';
}

/* ============================================================
   五、页面初始化
   ============================================================ */

async function initProductPage() {
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

  /* ---- 搜索框：在详情页搜索，跳到首页并带上关键词 ---- */
  var searchForm = utils.$('#searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var keyword = (utils.$('#searchInput').value || '').trim();
      if (!keyword) return;
      window.location.href = './index.html?keyword=' + encodeURIComponent(keyword);
    });
  }

  /* ---- 2. 读出 id 并加载商品 ---- */
  var productId = getProductIdFromUrl();

  if (!productId) {
    renderDetailError('地址里没有商品编号（正确格式应该是 product.html?id=1）');
    return;
  }

  try {
    var product = await window.api.getProduct(productId);
    currentProduct = product;
    detailQuantity = 1;

    // 渲染详情
    renderProductDetail(product);
    updateDetailQtyButtons(product);

    // 加载同类推荐（不阻塞主要内容的显示）
    loadRelatedProducts(product);

  } catch (err) {
    console.error('商品详情加载失败：', err);
    renderDetailError(err.message);
  }
}

document.addEventListener('DOMContentLoaded', initProductPage);
