/* ============================================================
   search.js —— 搜索结果页
   ------------------------------------------------------------
   【这个页面是干什么的？】
   从首页点搜索后跳到这里，专门展示搜索结果。
   以前搜索是"在首页原地筛选 + 滚到商品区"，现在改成独立页面，
   好处是：

   1. 搜索结果有自己的地址，能分享、能收藏、能刷新
      search.html?keyword=耳机&maxPrice=500&sort=price_asc
   2. 浏览器后退能回到搜索结果，而不是一路滚回首页顶部
   3. 结果多的时候不跟首页的横幅、分类、推荐区挤在一起

   【状态从哪来？】
   全部从地址栏的查询参数读，这是唯一的数据来源。
   筛选条件一变，就改地址栏 + 重新请求接口。
   这样"界面显示"和"地址栏"永远一致，不会出现
   "看起来筛过了但一刷新就变回去"的问题。
   ============================================================ */

/* ============================================================
   一、状态
   ============================================================ */

var searchState = {
  keyword: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  sort: 'default',
  page: 1,
  pageSize: 12
};

// 热门搜索词，没搜到结果时给用户一点引导
var HOT_KEYWORDS = ['耳机', '机械键盘', '鼠标', '充电宝', '台灯', '支架'];

/* ============================================================
   二、地址栏 <-> 状态
   ============================================================ */

/**
 * 从地址栏读参数，填进 searchState
 */
function readStateFromUrl() {
  searchState.keyword = utils.getUrlParam('keyword');
  searchState.category = utils.getUrlParam('category');
  searchState.minPrice = utils.getUrlParam('minPrice');
  searchState.maxPrice = utils.getUrlParam('maxPrice');
  searchState.sort = utils.getUrlParam('sort') || 'default';

  var page = parseInt(utils.getUrlParam('page'), 10);
  searchState.page = !isNaN(page) && page > 0 ? page : 1;
}

/**
 * 把当前状态写回地址栏。
 *
 * 用 history.replaceState 而不是跳转：
 * 只改地址栏，不重新加载页面，也不往浏览历史里塞一堆记录
 * （否则用户点几次筛选，就要按好几次后退才能离开这个页面）。
 */
function syncUrl() {
  var params = [];

  function add(key, value) {
    if (value === undefined || value === null || value === '') return;
    params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  }

  add('keyword', searchState.keyword);
  add('category', searchState.category);
  add('minPrice', searchState.minPrice);
  add('maxPrice', searchState.maxPrice);
  // 默认排序不写进地址，让地址更干净
  if (searchState.sort && searchState.sort !== 'default') {
    add('sort', searchState.sort);
  }
  if (searchState.page > 1) add('page', searchState.page);

  var url = './search.html' + (params.length > 0 ? '?' + params.join('&') : '');

  try {
    history.replaceState(null, '', url);
  } catch (err) {
    // 极少数环境（比如 file:// 打开）不支持，忽略即可，不影响功能
  }
}

/* ============================================================
   三、加载结果
   ============================================================ */

async function loadResults() {
  var grid = utils.$('#productGrid');
  var title = utils.$('#searchTitle');
  var sub = utils.$('#searchSub');
  var hint = utils.$('#searchHint');
  var emptyExtra = utils.$('#searchEmptyExtra');

  /* ---- 没有任何搜索条件：提示用户去搜，不发请求 ----
     注意 sort 也算"条件"：用户明确选了排序，就说明他想看结果，
     不该把他打回"请输入关键词"的空白页。 */
  var hasAnyCondition = !!(
    searchState.keyword || searchState.category ||
    searchState.minPrice !== '' || searchState.maxPrice !== '' ||
    searchState.sort !== 'default'
  );

  if (!hasAnyCondition) {
    if (title) title.textContent = '搜索商品';
    if (sub) sub.textContent = '输入关键词开始搜索';
    if (hint) hint.hidden = false;
    if (emptyExtra) emptyExtra.hidden = true;
    if (grid) {
      grid.innerHTML =
        '<div class="empty-text">' +
          '<div class="empty-icon">' + window.icons.icon('search', 40) + '</div>' +
          '在上面输入关键词，找找你想要的东西' +
        '</div>';
    }
    components.renderPagination(null);
    renderActiveFilters();
    return;
  }

  if (hint) hint.hidden = true;
  if (grid) grid.innerHTML = '<p class="loading-text">搜索中…</p>';

  try {
    var result = await window.api.getProducts({
      keyword: searchState.keyword,
      category: searchState.category,
      minPrice: searchState.minPrice,
      maxPrice: searchState.maxPrice,
      sort: searchState.sort,
      page: searchState.page,
      pageSize: searchState.pageSize
    });

    /* ---- 标题 ---- */
    renderHeadline(title, sub, result);

    /* ---- 商品 ---- */
    if (result.items.length === 0) {
      components.renderProductGrid(grid, [], buildEmptyMessage());
      if (emptyExtra) {
        emptyExtra.hidden = false;
        renderSuggestChips();
      }
    } else {
      components.renderProductGrid(grid, result.items);
      if (emptyExtra) emptyExtra.hidden = true;
    }

    /* ---- 分页与已选条件 ---- */
    components.renderPagination(result);
    renderActiveFilters();

  } catch (err) {
    console.error('搜索失败：', err);
    if (sub) sub.textContent = '搜索失败';
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

/**
 * 渲染页面大标题和副标题
 */
function renderHeadline(title, sub, result) {
  if (!title || !sub) return;

  var parts = [];

  if (searchState.keyword) {
    parts.push('「' + searchState.keyword + '」');
  }
  if (searchState.category) {
    parts.push(components.getCategoryName(searchState.category));
  }
  if (searchState.minPrice !== '' || searchState.maxPrice !== '') {
    parts.push(priceRangeText());
  }

  var label = parts.length > 0 ? parts.join(' · ') : '全部商品';

  if (searchState.keyword) {
    title.textContent = '搜索 ' + label;
  } else {
    title.textContent = label;
  }

  sub.textContent = result.total > 0
    ? '共 ' + result.total + ' 件商品' +
      (result.totalPages > 1 ? ' · 第 ' + result.page + '/' + result.totalPages + ' 页' : '')
    : '没有找到符合条件的商品';
}

/**
 * 价格区间的文字描述
 */
function priceRangeText() {
  var min = searchState.minPrice;
  var max = searchState.maxPrice;

  if (min !== '' && max !== '') return '¥' + min + ' ~ ¥' + max;
  if (min !== '') return '¥' + min + ' 以上';
  return '¥' + max + ' 以下';
}

/**
 * 没结果时的提示语
 */
function buildEmptyMessage() {
  if (searchState.keyword) {
    return '没有找到和「' + searchState.keyword + '」相关的商品';
  }
  return '没有找到符合条件的商品';
}

/**
 * 渲染"换个词试试"的建议标签
 */
function renderSuggestChips() {
  var el = utils.$('#searchSuggestChips');
  if (!el) return;

  var html = '';
  for (var i = 0; i < HOT_KEYWORDS.length; i++) {
    html += '<a class="chip" href="./search.html?keyword=' +
            encodeURIComponent(HOT_KEYWORDS[i]) + '">' +
            utils.escapeHtml(HOT_KEYWORDS[i]) + '</a>';
  }
  el.innerHTML = html;
}

/* ============================================================
   四、已选筛选条件
   ============================================================ */

function renderActiveFilters() {
  var el = utils.$('#activeFilters');
  if (!el) return;

  var chips = [];

  if (searchState.keyword) {
    chips.push({ label: '关键词：' + searchState.keyword, key: 'keyword' });
  }
  if (searchState.category) {
    chips.push({ label: '分类：' + components.getCategoryName(searchState.category), key: 'category' });
  }
  if (searchState.minPrice !== '') {
    chips.push({ label: '最低 ¥' + searchState.minPrice, key: 'minPrice' });
  }
  if (searchState.maxPrice !== '') {
    chips.push({ label: '最高 ¥' + searchState.maxPrice, key: 'maxPrice' });
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
   五、加载分类下拉框
   ============================================================ */

async function loadCategoryOptions() {
  var select = utils.$('#filterCategory');
  if (!select) return;

  try {
    var categories = await window.api.getCategories();

    var html = '<option value="">全部分类</option>';
    for (var i = 0; i < categories.length; i++) {
      var c = categories[i];
      html += '<option value="' + utils.escapeHtml(c.id) + '">' +
              utils.escapeHtml(c.name) + ' (' + c.count + ')</option>';
    }
    select.innerHTML = html;
    select.value = searchState.category;

  } catch (err) {
    console.warn('分类加载失败：', err.message);
  }
}

/* ============================================================
   六、事件绑定
   ============================================================ */

function initSearchEvents() {
  /* ---------- 顶部搜索框：在本页直接重新搜 ----------
     不跳转，就地更新结果，体验更顺。
     地址栏会同步，所以分享出去还是对的。 */
  var searchForm = utils.$('#searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var input = utils.$('#searchInput');
      searchState.keyword = (input.value || '').trim();
      searchState.page = 1;

      syncUrl();
      loadResults();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- 分类筛选 ---------- */
  var filterCategory = utils.$('#filterCategory');
  if (filterCategory) {
    filterCategory.addEventListener('change', function () {
      searchState.category = filterCategory.value;
      searchState.page = 1;
      syncUrl();
      loadResults();
    });
  }

  /* ---------- 价格区间（用 change，输完整个数字才触发）---------- */
  var minPriceInput = utils.$('#filterMinPrice');
  if (minPriceInput) {
    minPriceInput.addEventListener('change', function () {
      searchState.minPrice = minPriceInput.value;
      searchState.page = 1;
      syncUrl();
      loadResults();
    });
  }

  var maxPriceInput = utils.$('#filterMaxPrice');
  if (maxPriceInput) {
    maxPriceInput.addEventListener('change', function () {
      searchState.maxPrice = maxPriceInput.value;
      searchState.page = 1;
      syncUrl();
      loadResults();
    });
  }

  /* ---------- 排序 ---------- */
  var filterSort = utils.$('#filterSort');
  if (filterSort) {
    filterSort.addEventListener('change', function () {
      searchState.sort = filterSort.value;
      searchState.page = 1;
      syncUrl();
      loadResults();
    });
  }

  /* ---------- 重置 ---------- */
  var resetBtn = utils.$('#filterReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      // 关键词也一起清掉，回到"什么都还没搜"的状态
      searchState.keyword = '';
      searchState.category = '';
      searchState.minPrice = '';
      searchState.maxPrice = '';
      searchState.sort = 'default';
      searchState.page = 1;

      if (utils.$('#searchInput')) utils.$('#searchInput').value = '';
      if (filterCategory) filterCategory.value = '';
      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      if (filterSort) filterSort.value = 'default';

      syncUrl();
      loadResults();
      utils.toast('已清空搜索条件', 'success');
    });
  }

  /* ---------- 移除单个筛选条件（事件委托）---------- */
  var activeFilters = utils.$('#activeFilters');
  if (activeFilters) {
    activeFilters.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-clear-filter]');
      if (!btn) return;

      var key = btn.getAttribute('data-clear-filter');
      searchState[key] = '';
      searchState.page = 1;

      // 同步界面控件
      if (key === 'keyword' && utils.$('#searchInput')) utils.$('#searchInput').value = '';
      if (key === 'category' && filterCategory) filterCategory.value = '';
      if (key === 'minPrice' && minPriceInput) minPriceInput.value = '';
      if (key === 'maxPrice' && maxPriceInput) maxPriceInput.value = '';

      syncUrl();
      loadResults();
    });
  }

  /* ---------- 分页（事件委托）---------- */
  var pagination = utils.$('#pagination');
  if (pagination) {
    pagination.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-page]');
      if (!btn || btn.disabled) return;

      var page = parseInt(btn.getAttribute('data-page'), 10);
      if (isNaN(page) || page < 1) return;

      searchState.page = page;
      syncUrl();
      loadResults();

      // 翻页后回到结果区顶部，而不是停在页面底部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/* ============================================================
   七、页面初始化
   ============================================================ */

async function initSearchPage() {
  // 1. 全局交互（购物车、登录、客服、AI 助手）
  cart.init();
  components.initGlobalComponents();

  await window.auth.init();

  if (window.agent && typeof window.agent.init === 'function') {
    window.agent.init();
  }
  if (window.support && typeof window.support.init === 'function') {
    window.support.init();
  }

  // 2. 从地址栏恢复状态
  readStateFromUrl();

  // 3. 把状态回填到界面控件
  if (utils.$('#searchInput')) utils.$('#searchInput').value = searchState.keyword;
  if (utils.$('#filterMinPrice')) utils.$('#filterMinPrice').value = searchState.minPrice;
  if (utils.$('#filterMaxPrice')) utils.$('#filterMaxPrice').value = searchState.maxPrice;
  if (utils.$('#filterSort')) utils.$('#filterSort').value = searchState.sort;

  // 4. 绑事件
  initSearchEvents();

  // 5. 加载数据（分类和结果可以并行）
  await Promise.all([loadCategoryOptions(), loadResults()]);
}

document.addEventListener('DOMContentLoaded', initSearchPage);
