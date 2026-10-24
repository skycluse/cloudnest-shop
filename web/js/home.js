/* ============================================================
   home.js —— 首页逻辑
   ------------------------------------------------------------
   负责：加载分类、加载商品、搜索、筛选、排序、分页
   ============================================================ */

/**
 * 首页的"状态"：当前用户选的筛选条件。
 * 每次筛选条件变化，就重新请求一次后端。
 *
 * 为什么不一次性把 24 个商品都拿到前端再筛？
 * 24 个当然可以。但真实商城有几十万商品，不可能全下发，
 * 所以必须由后端筛选 + 分页。这里就用真实项目的做法。
 */
var homeState = {
  keyword: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  sort: 'default',
  page: 1,
  pageSize: 12
};

// 记住分类列表，渲染筛选下拉框时要复用
var homeCategories = [];

/* ============================================================
   一、加载分类
   ============================================================ */

async function loadCategories() {
  try {
    homeCategories = await window.api.getCategories();

    // 1) 渲染分类卡片区
    components.renderCategoryGrid('#categoryGrid', homeCategories, homeState.category);

    // 2) 填充筛选下拉框
    var select = utils.$('#filterCategory');
    if (select) {
      var optionsHtml = '<option value="">全部分类</option>';
      for (var i = 0; i < homeCategories.length; i++) {
        var c = homeCategories[i];
        optionsHtml +=
          '<option value="' + utils.escapeHtml(c.id) + '">' +
          utils.escapeHtml(c.name) + ' (' + c.count + ')</option>';
      }
      select.innerHTML = optionsHtml;
    }

  } catch (err) {
    console.error('分类加载失败：', err);
    var grid = utils.$('#categoryGrid');
    if (grid) {
      grid.innerHTML = '<p class="empty-text">分类加载失败：' + utils.escapeHtml(err.message) + '</p>';
    }
  }
}

/* ============================================================
   一·五、加载"为你推荐"
   ------------------------------------------------------------
   需求里的"商品推荐区域"：首页固定展示 4 件评分最高的商品。
   数据同样来自后端接口（sort=rating），不是写死在前端的，
   所以商品改价、下架之后推荐区会自动跟着变。

   用户一旦开始搜索 / 筛选，推荐区就藏起来 ——
   因为这时候用户想看的是自己的筛选结果，而不是"猜你喜欢"。
   ============================================================ */

async function loadRecommend() {
  var grid = utils.$('#recommendGrid');
  if (!grid) return;

  try {
    var result = await window.api.getProducts({ sort: 'rating', page: 1, pageSize: 4 });
    components.renderProductGrid(grid, result.items, '暂时没有推荐商品');
  } catch (err) {
    // 推荐区是锦上添花的功能，挂了不能影响主列表，所以只记录、不弹错
    console.error('推荐商品加载失败：', err);
    grid.innerHTML = '<p class="empty-text">推荐暂时加载不出来，可以往下看全部商品</p>';
  }
}

/**
 * 有没有正在生效的筛选条件
 */
function hasActiveFilter() {
  return !!(homeState.keyword || homeState.category ||
            homeState.minPrice !== '' || homeState.maxPrice !== '' ||
            homeState.sort !== 'default');
}

/**
 * 根据筛选状态显示 / 隐藏推荐区
 */
function syncRecommendVisibility() {
  var section = utils.$('#recommend');
  if (section) section.hidden = hasActiveFilter();
}

/* ============================================================
   二、加载商品列表
   ============================================================ */
async function loadProducts() {
  var grid = utils.$('#productGrid');
  var sub = utils.$('#productsSub');
  var title = utils.$('#productsTitle');

  // 每次筛选条件变了都同步一次推荐区的显隐
  syncRecommendVisibility();

  if (grid) grid.innerHTML = '<p class="loading-text">商品加载中…</p>';

  try {
    // 只把有值的参数发出去
    var products = await window.api.getProducts({
      keyword: homeState.keyword,
      category: homeState.category,
      minPrice: homeState.minPrice,
      maxPrice: homeState.maxPrice,
      sort: homeState.sort,
      page: homeState.page,
      pageSize: homeState.pageSize
    });

    // 渲染商品网格
    components.renderProductGrid(grid, products.items, '没有找到符合条件的商品，试试别的关键词？');

    // 更新标题和数量
    if (title) {
      if (homeState.keyword) {
        title.textContent = '搜索「' + homeState.keyword + '」';
      } else if (homeState.category) {
        title.textContent = components.getCategoryName(homeState.category);
      } else {
        title.textContent = '全部商品';
      }
    }

    if (sub) {
      sub.textContent = '共 ' + products.total + ' 件商品' +
        (products.totalPages > 1 ? ' · 第 ' + products.page + '/' + products.totalPages + ' 页' : '');
    }

    // 渲染分页
    renderPagination(products);

    // 渲染已选筛选条件标签
    renderActiveFilters();

  } catch (err) {
    console.error('商品加载失败：', err);
    if (grid) {
      grid.innerHTML =
        '<div class="empty-text">' +
          '<div class="empty-icon">' + window.icons.icon('alertCircle', 40) + '</div>' +
          utils.escapeHtml(err.message) +
          '<br /><button class="btn btn-outline btn-sm" style="margin-top:12px" ' +
          'onclick="location.reload()">重新加载</button>' +
        '</div>';
    }
  }
}

/* ============================================================
   三、分页
   ============================================================ */

function renderPagination(result) {
  var el = utils.$('#pagination');
  if (!el) return;

  // 只有一页就不用显示分页了
  if (!result || result.totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  var current = result.page;
  var totalPages = result.totalPages;
  var html = '';

  // 上一页
  html += '<button class="page-btn" type="button" data-page="' + (current - 1) + '"' +
          (current <= 1 ? ' disabled' : '') + '>上一页</button>';

  // 页码：最多显示当前页前后各 2 页，避免页码太多把页面撑爆
  var start = Math.max(1, current - 2);
  var end = Math.min(totalPages, current + 2);

  if (start > 1) {
    html += '<button class="page-btn" type="button" data-page="1">1</button>';
    if (start > 2) html += '<span class="page-info">…</span>';
  }

  for (var p = start; p <= end; p++) {
    html += '<button class="page-btn' + (p === current ? ' is-active' : '') + '" ' +
            'type="button" data-page="' + p + '">' + p + '</button>';
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span class="page-info">…</span>';
    html += '<button class="page-btn" type="button" data-page="' + totalPages + '">' + totalPages + '</button>';
  }

  // 下一页
  html += '<button class="page-btn" type="button" data-page="' + (current + 1) + '"' +
          (current >= totalPages ? ' disabled' : '') + '>下一页</button>';

  el.innerHTML = html;
}

/* ============================================================
   四、已选筛选条件标签
   ============================================================ */

function renderActiveFilters() {
  var el = utils.$('#activeFilters');
  if (!el) return;

  var chips = [];

  if (homeState.keyword) {
    chips.push({ label: '关键词：' + homeState.keyword, key: 'keyword' });
  }
  if (homeState.category) {
    chips.push({ label: '分类：' + components.getCategoryName(homeState.category), key: 'category' });
  }
  if (homeState.minPrice !== '') {
    chips.push({ label: '最低 ¥' + homeState.minPrice, key: 'minPrice' });
  }
  if (homeState.maxPrice !== '') {
    chips.push({ label: '最高 ¥' + homeState.maxPrice, key: 'maxPrice' });
  }

  var html = '';
  for (var i = 0; i < chips.length; i++) {
    html +=
      '<span class="filter-chip">' +
        utils.escapeHtml(chips[i].label) +
        '<button type="button" data-clear-filter="' + chips[i].key + '" aria-label="移除">' +
          window.icons.icon('x', 13) +
        '</button>' +
      '</span>';
  }
  el.innerHTML = html;
}

/* ============================================================
   五、事件绑定
   ============================================================ */

function initHomeEvents() {
  /* ---------- 搜索表单 ---------- */
  var searchForm = utils.$('#searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();       // 阻止表单默认的"刷新页面"行为
      var input = utils.$('#searchInput');
      homeState.keyword = (input.value || '').trim();
      homeState.page = 1;           // 换了搜索词要回到第 1 页
      loadProducts();
      utils.scrollToElement('#products');
    });
  }

  /* ---------- 搜索框边打字边搜（防抖 400ms） ---------- */
  var searchInput = utils.$('#searchInput');
  if (searchInput) {
    var doLiveSearch = utils.debounce(function () {
      homeState.keyword = (searchInput.value || '').trim();
      homeState.page = 1;
      loadProducts();
    }, 400);

    searchInput.addEventListener('input', doLiveSearch);
  }

  /* ---------- 分类筛选下拉框 ---------- */
  var filterCategory = utils.$('#filterCategory');
  if (filterCategory) {
    filterCategory.addEventListener('change', function () {
      homeState.category = filterCategory.value;
      homeState.page = 1;
      loadProducts();
      syncCategoryCards();
    });
  }

  /* ---------- 价格区间 ----------
     用 change 而不是 input：用户输完一整个数字再触发，
     每敲一个字符就请求一次太浪费了。
  */
  var minPriceInput = utils.$('#filterMinPrice');
  if (minPriceInput) {
    minPriceInput.addEventListener('change', function () {
      homeState.minPrice = minPriceInput.value;
      homeState.page = 1;
      loadProducts();
    });
  }

  var maxPriceInput = utils.$('#filterMaxPrice');
  if (maxPriceInput) {
    maxPriceInput.addEventListener('change', function () {
      homeState.maxPrice = maxPriceInput.value;
      homeState.page = 1;
      loadProducts();
    });
  }

  /* ---------- 排序 ---------- */
  var filterSort = utils.$('#filterSort');
  if (filterSort) {
    filterSort.addEventListener('change', function () {
      homeState.sort = filterSort.value;
      homeState.page = 1;
      loadProducts();
    });
  }

  /* ---------- 重置 ---------- */
  var resetBtn = utils.$('#filterReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      resetFilters();
    });
  }

  /* ---------- 点击分类卡片 ---------- */
  var categoryGrid = utils.$('#categoryGrid');
  if (categoryGrid) {
    categoryGrid.addEventListener('click', function (event) {
      var card = event.target.closest('[data-category]');
      if (!card) return;

      var categoryId = card.getAttribute('data-category');

      // 再点一次同一个分类 = 取消筛选
      homeState.category = homeState.category === categoryId ? '' : categoryId;
      homeState.page = 1;

      // 把筛选下拉框的值同步过去，两处显示要一致
      if (filterCategory) filterCategory.value = homeState.category;

      syncCategoryCards();
      loadProducts();
      utils.scrollToElement('#products');
    });
  }

  /* ---------- 分页按钮（事件委托） ---------- */
  var pagination = utils.$('#pagination');
  if (pagination) {
    pagination.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-page]');
      if (!btn || btn.disabled) return;

      var page = parseInt(btn.getAttribute('data-page'), 10);
      if (isNaN(page) || page < 1) return;

      homeState.page = page;
      loadProducts();
      utils.scrollToElement('#products');
    });
  }

  /* ---------- 移除单个筛选条件 ---------- */
  var activeFilters = utils.$('#activeFilters');
  if (activeFilters) {
    activeFilters.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-clear-filter]');
      if (!btn) return;

      var key = btn.getAttribute('data-clear-filter');
      homeState[key] = '';
      homeState.page = 1;

      // 同步界面控件
      if (key === 'keyword' && searchInput) searchInput.value = '';
      if (key === 'category' && filterCategory) filterCategory.value = '';
      if (key === 'minPrice' && minPriceInput) minPriceInput.value = '';
      if (key === 'maxPrice' && maxPriceInput) maxPriceInput.value = '';

      syncCategoryCards();
      loadProducts();
    });
  }
}

/**
 * 让分类卡片的高亮状态和 homeState.category 保持一致
 */
function syncCategoryCards() {
  var cards = utils.$$('[data-category]', utils.$('#categoryGrid'));
  for (var i = 0; i < cards.length; i++) {
    var id = cards[i].getAttribute('data-category');
    if (id === homeState.category) {
      cards[i].classList.add('is-active');
    } else {
      cards[i].classList.remove('is-active');
    }
  }
}

/**
 * 重置所有筛选条件
 */
function resetFilters() {
  homeState.keyword = '';
  homeState.category = '';
  homeState.minPrice = '';
  homeState.maxPrice = '';
  homeState.sort = 'default';
  homeState.page = 1;

  // 清空界面控件
  if (utils.$('#searchInput')) utils.$('#searchInput').value = '';
  if (utils.$('#filterCategory')) utils.$('#filterCategory').value = '';
  if (utils.$('#filterMinPrice')) utils.$('#filterMinPrice').value = '';
  if (utils.$('#filterMaxPrice')) utils.$('#filterMaxPrice').value = '';
  if (utils.$('#filterSort')) utils.$('#filterSort').value = 'default';

  syncCategoryCards();
  loadProducts();
  utils.toast('已重置筛选条件', 'success');
}

/* ============================================================
   六、页面初始化
   ============================================================ */

async function initHomePage() {
  // 1. 先恢复购物车，并挂上所有全局交互（购物车抽屉、结算弹窗等）
  cart.init();
  components.initGlobalComponents();

  /* 确认登录状态。
     会先问后端"我这个 token 对应谁"，
     然后渲染导航栏右上角的登录按钮 / 用户菜单。
     注意用了 await —— 后面的逻辑可能需要知道"是否已登录"。 */
  if (window.auth && typeof window.auth.init === 'function') {
    await window.auth.init();
  }

  // 1.5 初始化 AI 购物助手（浮窗按钮、输入框、快捷问题）
  if (window.agent && typeof window.agent.init === 'function') {
    window.agent.init();
  }

  /* 初始化 AI 客服（顶部入口）。
     必须放在 agent.init() 之后，因为它要用 agent.tools 里的工具函数
     （搜索商品、加购物车），那些是在 agent.js 加载时就绪的。 */
  if (window.support && typeof window.support.init === 'function') {
    window.support.init();
  }

  // 2. 支持从别的页面带参数跳过来，如 index.html?keyword=耳机
  var urlKeyword = utils.getUrlParam('keyword');
  var urlCategory = utils.getUrlParam('category');
  if (urlKeyword) {
    homeState.keyword = urlKeyword;
    if (utils.$('#searchInput')) utils.$('#searchInput').value = urlKeyword;
  }
  if (urlCategory) {
    homeState.category = urlCategory;
  }

  // 3. 绑事件
  initHomeEvents();

  // 4. 加载数据（分类、推荐、商品三件事互不依赖，用 Promise.all 一起等）
  await Promise.all([loadCategories(), loadRecommend(), loadProducts()]);

  // 5. 分类加载完后再同步一次高亮
  if (homeState.category) syncCategoryCards();

  // 6. Hero 区域的"让 AI 帮我挑"按钮 → 打开 AI 助手
  var heroAgentBtn = utils.$('#heroAgentBtn');
  if (heroAgentBtn) {
    heroAgentBtn.addEventListener('click', function () {
      if (window.agent) window.agent.open();
    });
  }

  // 7. 如果地址栏带了分类，自动滚到商品区
  if (urlCategory) {
    setTimeout(function () { utils.scrollToElement('#products'); }, 200);
  }
}

// DOMContentLoaded：HTML 结构解析完了就执行（不用等图片加载，更快）
document.addEventListener('DOMContentLoaded', initHomePage);
