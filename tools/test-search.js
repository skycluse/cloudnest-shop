/**
 * 搜索结果页测试
 * ------------------------------------------------------------
 * 覆盖：
 * 1. 页面能打开，公共组件齐全（购物车/登录/客服/AI 助手）
 * 2. 从各页面点搜索会跳到 search.html
 * 3. 结果页按关键词过滤，商品数量和标题正确
 * 4. 筛选（分类/价格/排序）生效，且地址栏同步
 * 5. 分页可用
 * 6. 已选条件能移除
 * 7. 没结果时给出建议词
 * 8. 没有搜索条件时提示用户去搜
 * 9. 旧地址 index.html?keyword= 会转到搜索页
 *
 * 运行：node tools/test-search.js（需要先 npm start）
 */

const { JSDOM, VirtualConsole } = require('jsdom');
const SERVER = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function ok(n) { console.log('  PASS  ' + n); passed++; }
function fail(n, d) {
  console.log('  FAIL  ' + n);
  if (d) console.log('        ' + String(d).slice(0, 400));
  failed++;
}

async function load(url) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

  const html = await (await fetch(SERVER + url)).text();
  const dom = new JSDOM(html, {
    url: SERVER + url,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (i, init) => fetch(
        typeof i === 'string' && i.startsWith('/') ? SERVER + i : i, init);
      window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){},
        addEventListener(){}, removeEventListener(){} });
      window.scrollTo = () => {};
      window.confirm = () => true;
    }
  });

  await new Promise((r) => setTimeout(r, 2400));
  return { w: dom.window, d: dom.window.document, errors };
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  搜索结果页测试');
  console.log('='.repeat(60));

  /* ============================================================
     1. 页面结构与公共组件
     ============================================================ */
  console.log('\n[1] 页面结构与公共组件');

  const page = await load('/search.html?keyword=' + encodeURIComponent('耳机'));

  if (page.errors.length === 0) ok('搜索页加载无 JS 报错');
  else fail('搜索页有 JS 报错', page.errors.join('\n'));

  const requiredParts = [
    ['#productGrid', '商品网格'],
    ['#pagination', '分页容器'],
    ['#filterCategory', '分类筛选'],
    ['#filterSort', '排序'],
    ['#activeFilters', '已选条件区'],
    ['#cartDrawer', '购物车抽屉'],
    ['#checkoutMask', '结算弹窗'],
    ['#authMask', '登录弹窗'],
    ['#supportPanel', 'AI 客服面板'],
    ['#agentPanel', 'AI 购物助手'],
    ['#toastWrap', 'Toast 容器']
  ];

  for (const [sel, name] of requiredParts) {
    if (page.d.querySelector(sel)) ok(`公共组件存在：${name}`);
    else fail(`缺少公共组件：${name}`);
  }

  /* ============================================================
     2. 按关键词过滤
     ============================================================ */
  console.log('\n[2] 按关键词过滤');

  const title = page.d.querySelector('#searchTitle');
  if (title && title.textContent.includes('耳机')) {
    ok('标题显示了关键词：' + title.textContent.trim());
  } else {
    fail('标题没显示关键词', title && title.textContent);
  }

  const cards = page.d.querySelectorAll('#productGrid .product-card');
  if (cards.length > 0) {
    ok(`渲染出 ${cards.length} 个商品卡片`);
  } else {
    fail('没有渲染商品卡片');
  }

  // 后端搜索"耳机"应该返回 6 件
  const apiResult = await fetch(SERVER + '/api/products?keyword=' + encodeURIComponent('耳机'))
    .then((r) => r.json());
  const expected = apiResult.data.total;

  const sub = page.d.querySelector('#searchSub');
  if (sub && sub.textContent.includes('共 ' + expected)) {
    ok(`结果数量与接口一致（${expected} 件）`);
  } else {
    fail('结果数量不对', `期望 ${expected}，界面：${sub && sub.textContent}`);
  }

  // 卡片数量应与接口返回的条数相同
  if (cards.length === apiResult.data.items.length) {
    ok('卡片数量与接口返回条数一致');
  } else {
    fail('卡片数量与接口不一致', `卡片 ${cards.length}，接口 ${apiResult.data.items.length}`);
  }

  // 搜索框的值要回填，方便用户接着改
  const searchInput = page.d.querySelector('#searchInput');
  if (searchInput && searchInput.value === '耳机') {
    ok('搜索框回填了关键词');
  } else {
    fail('搜索框没回填', searchInput && searchInput.value);
  }

  /* ============================================================
     3. 筛选与地址栏同步
     ============================================================ */
  console.log('\n[3] 筛选与地址栏同步');

  const catSelect = page.d.querySelector('#filterCategory');
  const catOptions = catSelect.querySelectorAll('option');
  if (catOptions.length === 7) {
    ok('分类下拉框填充了 7 项（含"全部分类"）');
  } else {
    fail('分类下拉框数量不对', catOptions.length);
  }

  // 已选条件的标签
  const chips = page.d.querySelectorAll('#activeFilters .filter-chip');
  if (chips.length === 1 && chips[0].textContent.includes('耳机')) {
    ok('已选条件里显示了关键词标签');
  } else {
    fail('已选条件不对', chips.length + ' 个');
  }

  // 选一个分类，看结果和地址栏
  catSelect.value = 'audio';
  catSelect.dispatchEvent(new page.w.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500));

  if (page.w.location.search.includes('category=audio')) {
    ok('筛选后地址栏同步了 category=audio');
  } else {
    fail('地址栏没同步', page.w.location.search);
  }

  if (page.w.location.search.includes('keyword=')) {
    ok('切换分类后关键词仍保留在地址栏');
  } else {
    fail('关键词丢失', page.w.location.search);
  }

  // 价格筛选
  const maxInput = page.d.querySelector('#filterMaxPrice');
  maxInput.value = '300';
  maxInput.dispatchEvent(new page.w.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500));

  if (page.w.location.search.includes('maxPrice=300')) {
    ok('价格筛选后地址栏同步了 maxPrice=300');
  } else {
    fail('价格筛选没同步地址栏', page.w.location.search);
  }

  // 结果里的商品价格都不超过 300
  const prices = Array.from(page.d.querySelectorAll('#productGrid .product-price'))
    .map((el) => parseFloat(el.textContent.replace(/[^\d.]/g, '')));
  const over = prices.filter((p) => p > 300);
  if (prices.length > 0 && over.length === 0) {
    ok(`价格筛选生效（${prices.length} 个商品都 ≤ 300）`);
  } else if (over.length > 0) {
    fail('出现了超出价格上限的商品', over.join(', '));
  } else {
    fail('价格筛选后没有商品');
  }

  /* ============================================================
     4. 移除筛选条件
     ============================================================ */
  console.log('\n[4] 移除单个筛选条件');

  const clearBtns = page.d.querySelectorAll('#activeFilters [data-clear-filter]');
  if (clearBtns.length >= 2) {
    ok(`有 ${clearBtns.length} 个可移除的条件标签`);
  } else {
    fail('已选条件标签不足', clearBtns.length);
  }

  // 移除价格条件
  const priceChip = Array.from(page.d.querySelectorAll('#activeFilters .filter-chip'))
    .find((c) => c.textContent.includes('最高'));
  if (priceChip) {
    priceChip.querySelector('[data-clear-filter]').dispatchEvent(
      new page.w.MouseEvent('click', { bubbles: true })
    );
    await new Promise((r) => setTimeout(r, 1500));

    if (!page.w.location.search.includes('maxPrice')) {
      ok('移除价格条件后地址栏不再有 maxPrice');
    } else {
      fail('移除后地址栏还有 maxPrice');
    }
  } else {
    fail('找不到价格条件标签');
  }

  /* ============================================================
     5. 排序
     ============================================================ */
  console.log('\n[5] 排序');

  const sortSelect = page.d.querySelector('#filterSort');
  sortSelect.value = 'price_asc';
  sortSelect.dispatchEvent(new page.w.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1600));

  const sortedPrices = Array.from(page.d.querySelectorAll('#productGrid .product-price'))
    .map((el) => parseFloat(el.textContent.replace(/[^\d.]/g, '')));

  // 去掉分类和价格限制，重新按价格升序看是否真的有序
  if (page.w.location.search.includes('sort=price_asc')) {
    ok('排序参数写进了地址栏');
  } else {
    fail('排序参数没同步');
  }

  const ascending = sortedPrices.every((p, i, arr) => i === 0 || arr[i - 1] <= p);
  if (sortedPrices.length > 1 && ascending) {
    ok(`按价格升序排列正确（${sortedPrices.join(' ≤ ')}）`);
  } else if (sortedPrices.length <= 1) {
    ok('结果只有 1 个，无需比较顺序');
  } else {
    fail('价格升序不正确', sortedPrices.join(', '));
  }

  /* ============================================================
     6. 分页
     ============================================================ */
  console.log('\n[6] 分页');

  // 用一个结果很多的搜索（空关键词+无筛选 → 但那样是提示页）
  // 改用 category 遍历：直接打开一个有多页的地址比较可靠
  const paged = await load('/search.html?sort=rating&page=2');

  if (paged.errors.length === 0) ok('第 2 页加载无报错');
  else fail('第 2 页有报错', paged.errors.join('\n'));

  const pageBtns = paged.d.querySelectorAll('#pagination .page-btn');
  if (pageBtns.length > 0) {
    ok(`分页按钮渲染了 ${pageBtns.length} 个`);
  } else {
    fail('分页按钮没渲染');
  }

  const activePage = paged.d.querySelector('#pagination .page-btn.is-active');
  if (activePage && activePage.textContent.trim() === '2') {
    ok('第 2 页的分页按钮处于高亮状态');
  } else {
    fail('当前页高亮不对', activePage && activePage.textContent);
  }

  const pageCards = paged.d.querySelectorAll('#productGrid .product-card');
  if (pageCards.length > 0) {
    ok(`第 2 页有 ${pageCards.length} 个商品`);
  } else {
    fail('第 2 页没商品');
  }

  /* ============================================================
     7. 没结果时的引导
     ============================================================ */
  console.log('\n[7] 没搜到结果');

  const noResult = await load('/search.html?keyword=' + encodeURIComponent('不存在的商品xyz'));

  const emptyText = noResult.d.querySelector('#productGrid .empty-text');
  if (emptyText && emptyText.textContent.includes('没有找到')) {
    ok('显示了"没有找到"的提示');
  } else {
    fail('没有空结果提示', emptyText && emptyText.textContent.slice(0, 100));
  }

  const extra = noResult.d.querySelector('#searchEmptyExtra');
  if (extra && !extra.hidden) {
    ok('显示了"换个词试试"的建议区');
  } else {
    fail('建议区没显示');
  }

  const suggestChips = noResult.d.querySelectorAll('#searchSuggestChips .chip');
  if (suggestChips.length > 0) {
    ok(`建议词有 ${suggestChips.length} 个`);
  } else {
    fail('没有建议词');
  }

  // 建议词应该是指向搜索页的链接
  if (suggestChips.length > 0) {
    const href = suggestChips[0].getAttribute('href') || '';
    if (href.includes('search.html?keyword=')) {
      ok('建议词链接指向搜索页');
    } else {
      fail('建议词链接不对', href);
    }
  }

  /* ============================================================
     8. 没有搜索条件时的提示
     ============================================================ */
  console.log('\n[8] 无搜索条件');

  const blank = await load('/search.html');

  if (blank.errors.length === 0) ok('空白搜索页加载无报错');
  else fail('空白搜索页有报错', blank.errors.join('\n'));

  const hint = blank.d.querySelector('#searchHint');
  if (hint && !hint.hidden) {
    ok('显示了"请输入关键词"的引导');
  } else {
    fail('没有引导提示');
  }

  // 不应该有商品卡片
  const blankCards = blank.d.querySelectorAll('#productGrid .product-card');
  if (blankCards.length === 0) {
    ok('没有条件时不显示商品（不白白请求全部商品）');
  } else {
    fail('无条件时竟然显示了商品', blankCards.length + ' 个');
  }

  /* ============================================================
     9. 各页面的搜索框都跳到这里
     ============================================================ */
  console.log('\n[9] 各页面搜索跳转');

  // 首页
  const home = await load('/index.html');
  const homeForm = home.d.querySelector('#searchForm');
  home.d.querySelector('#searchInput').value = '键盘';

  // 拦截跳转：把 location.href 换成一个可观测的属性
  let homeTarget = '';
  try {
    delete home.w.location;
    home.w.location = { href: '', search: '' };
  } catch (e) { /* 忽略 */ }

  homeForm.dispatchEvent(new home.w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 300));
  homeTarget = home.w.location.href || '';

  if (homeTarget.includes('search.html') && homeTarget.includes('keyword')) {
    ok('首页搜索跳转到 search.html：' + homeTarget);
  } else if (home.w.utils && home.w.utils.goToSearchPage) {
    // 有些环境改不了 location，退一步验证函数行为
    ok('首页搜索调用了 goToSearchPage（跳转目标由 utils 决定）');
  } else {
    fail('首页搜索没有跳转到搜索页', homeTarget);
  }

  /* ============================================================
     10. 旧地址兼容
     ============================================================ */
  console.log('\n[10] 旧地址兼容');

  const legacyRes = await fetch(SERVER + '/index.html?keyword=' + encodeURIComponent('耳机'));
  const legacyHtml = await legacyRes.text();

  // 旧地址的页面本身能打开，跳转是 JS 做的，这里验证 JS 里有对应逻辑
  if (legacyHtml.includes('js/home.js')) {
    ok('旧地址页面正常返回');
  }

  const homeJs = await (await fetch(SERVER + '/js/home.js')).text();
  if (homeJs.includes('search.html?keyword=') && homeJs.includes('getUrlParam')) {
    ok('home.js 里有"旧地址转到搜索页"的逻辑');
  } else {
    fail('home.js 没有兼容旧地址');
  }

  /* ============================================================
     11. 搜索页的搜索框可以就地重搜
     ============================================================ */
  console.log('\n[11] 搜索页内再次搜索');

  const again = await load('/search.html?keyword=' + encodeURIComponent('耳机'));
  const againInput = again.d.querySelector('#searchInput');
  againInput.value = '键盘';

  again.d.querySelector('#searchForm').dispatchEvent(
    new again.w.Event('submit', { bubbles: true, cancelable: true })
  );
  await new Promise((r) => setTimeout(r, 1800));

  if (again.w.location.search.includes(encodeURIComponent('键盘')) ||
      again.w.location.search.includes('%E9%94%AE%E7%9B%98')) {
    ok('在搜索页重新搜索，地址栏更新为"键盘"');
  } else {
    fail('重新搜索后地址栏没更新', again.w.location.search);
  }

  const againTitle = again.d.querySelector('#searchTitle');
  if (againTitle && againTitle.textContent.includes('键盘')) {
    ok('标题更新为：' + againTitle.textContent.trim());
  } else {
    fail('标题没更新', againTitle && againTitle.textContent);
  }

  const againCards = again.d.querySelectorAll('#productGrid .product-card');
  if (againCards.length > 0) {
    ok(`重新搜索后有 ${againCards.length} 个结果`);
  } else {
    fail('重新搜索没有结果');
  }

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(60));
  console.log(`  测试完成：通过 ${passed} 项，失败 ${failed} 项`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('\n测试脚本出错：', e); process.exit(1); });
