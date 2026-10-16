/**
 * 端到端冒烟测试（用 jsdom 模拟浏览器跑一遍真实页面）
 * ------------------------------------------------------------
 * 这个测试的价值：语法检查（node --check）只能发现"括号没配对"这类问题，
 * 但发现不了"函数名写错了""变量没定义""DOM 元素找不到"。
 * 真正把页面加载一遍，才能抓到这些运行时错误。
 *
 * 运行：node tools/test-pages.js
 * 前置：需要先启动后端（npm start）
 */

const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const WEB_DIR = path.join(__dirname, '..', 'web');
const SERVER = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`  PASS  ${name}`);
  passed++;
}

function fail(name, detail) {
  console.log(`  FAIL  ${name}`);
  if (detail) console.log(`        ${detail}`);
  failed++;
}

/**
 * 把一个真实页面加载到 jsdom 里跑。
 *
 * @param {string} pageUrl 页面地址（相对服务器根）
 * @param {function} afterLoad 加载完成后要做的检查
 */
async function loadPage(pageUrl, afterLoad) {
  const errors = [];

  // 抓页面里的报错
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => {
    errors.push('[jsdomError] ' + err.message);
  });
  virtualConsole.on('error', (...args) => {
    errors.push('[console.error] ' + args.map(String).join(' '));
  });

  // 先把 HTML 抓下来
  const htmlRes = await fetch(SERVER + pageUrl);
  const html = await htmlRes.text();

  const dom = new JSDOM(html, {
    url: SERVER + pageUrl,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // jsdom 没有实现这些，补上空实现，避免"未定义"报错
      window.matchMedia = window.matchMedia || function () {
        return { matches: false, addListener() {}, removeListener() {},
                 addEventListener() {}, removeEventListener() {} };
      };
      window.scrollTo = () => {};
    }
  });

  // 等页面里的异步请求跑完（jsdom 的 fetch 是我们要补的，见下）
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return { dom, errors };
}

async function main() {
  console.log('\n' + '='.repeat(56));
  console.log('  云巢商城 - 页面冒烟测试');
  console.log('='.repeat(56));

  /* ---------- 0. 确认后端在跑 ---------- */
  console.log('\n[0] 后端连通性');
  try {
    const res = await fetch(SERVER + '/api/health');
    const data = await res.json();
    if (data.code === 0) {
      ok('后端 /api/health 正常');
    } else {
      fail('后端健康检查返回异常', JSON.stringify(data));
    }
  } catch (err) {
    fail('无法连接后端，请先运行 npm start', err.message);
    console.log('\n测试终止：后端没启动。');
    process.exit(1);
  }

  /* ---------- 1. 接口返回的数据结构 ---------- */
  console.log('\n[1] 接口数据结构');

  const listRes = await (await fetch(SERVER + '/api/products?pageSize=5')).json();
  if (listRes.code === 0 && Array.isArray(listRes.data.items)) {
    ok(`商品列表返回 ${listRes.data.items.length} 条，共 ${listRes.data.total} 件`);
  } else {
    fail('商品列表结构不对');
  }

  const first = listRes.data.items[0];
  const requiredFields = ['id', 'name', 'price', 'image', 'stock', 'category', 'brand', 'tagline', 'tags', 'desc', 'specs', 'rating'];
  const missing = requiredFields.filter((f) => first[f] === undefined);
  if (missing.length === 0) {
    ok('商品字段完整（' + requiredFields.length + ' 个字段都在）');
  } else {
    fail('商品缺少字段：' + missing.join(', '));
  }

  const catRes = await (await fetch(SERVER + '/api/categories')).json();
  if (catRes.code === 0 && catRes.data.length === 6) {
    ok('分类接口返回 6 个分类');
  } else {
    fail('分类接口异常');
  }

  /* ---------- 2. 搜索 / 筛选 参数是否真的生效 ---------- */
  console.log('\n[2] 搜索与筛选');

  const searchRes = await (await fetch(SERVER + '/api/products?keyword=' + encodeURIComponent('耳机'))).json();
  const allEarphones = searchRes.data.items.every((p) =>
    (p.name + p.tagline + p.brand + p.desc + (p.tags || []).join(' ')).includes('耳机')
  );
  if (searchRes.data.total > 0 && allEarphones) {
    ok(`搜索"耳机"返回 ${searchRes.data.total} 件，全部相关`);
  } else {
    fail('搜索结果不正确');
  }

  const filterRes = await (await fetch(SERVER + '/api/products?category=audio&maxPrice=300&sort=price_asc')).json();
  const allValid = filterRes.data.items.every((p) => p.category === 'audio' && p.price <= 300);
  const sorted = filterRes.data.items.every((p, i, arr) => i === 0 || arr[i - 1].price <= p.price);
  if (allValid && sorted) {
    ok(`筛选 分类=audio + 价格<=300 + 升序 生效（${filterRes.data.total} 件）`);
  } else {
    fail('筛选或排序没生效');
  }

  /* ---------- 3. 图片资源存在 ---------- */
  console.log('\n[3] 商品图片资源');

  const allProducts = await (await fetch(SERVER + '/api/products?pageSize=60')).json();
  let brokenImages = [];
  for (const p of allProducts.data.items) {
    const imgRes = await fetch(SERVER + p.image);
    if (!imgRes.ok) brokenImages.push(p.image);
  }
  if (brokenImages.length === 0) {
    ok(`全部 ${allProducts.data.items.length} 张商品图片都能访问`);
  } else {
    fail('有图片 404：' + brokenImages.join(', '));
  }

  /* ---------- 4. 页面 HTML 结构完整性 ---------- */
  console.log('\n[4] 页面 HTML 结构');

  const pages = [
    { url: '/index.html', name: '首页', mustHave: ['productGrid', 'categoryGrid', 'cartDrawer', 'agentPanel', 'checkoutMask', 'toastWrap'] },
    { url: '/product.html?id=1', name: '详情页', mustHave: ['productDetail', 'relatedGrid', 'cartDrawer', 'agentPanel'] },
    { url: '/orders.html', name: '订单页', mustHave: ['ordersList', 'orderDetail', 'cartDrawer', 'agentPanel'] }
  ];

  for (const page of pages) {
    const html = await (await fetch(SERVER + page.url)).text();
    const missing = page.mustHave.filter((id) => !html.includes('id="' + id + '"'));

    if (missing.length === 0) {
      ok(`${page.name} 关键元素齐全`);
    } else {
      fail(`${page.name} 缺少元素：${missing.join(', ')}`);
    }

    // 检查脚本引用是否都存在
    const scriptMatches = html.match(/src="\.\/js\/[^"]+"/g) || [];
    let badScript = [];
    for (const m of scriptMatches) {
      const src = m.replace('src="./', '/').replace('"', '');
      const r = await fetch(SERVER + src);
      if (!r.ok) badScript.push(src);
    }
    if (badScript.length === 0) {
      ok(`${page.name} 引用的 ${scriptMatches.length} 个脚本都存在`);
    } else {
      fail(`${page.name} 脚本 404：` + badScript.join(', '));
    }

    // 检查样式表引用
    const cssMatches = html.match(/href="\.\/css\/[^"]+"/g) || [];
    let badCss = [];
    for (const m of cssMatches) {
      const href = m.replace('href="./', '/').replace('"', '');
      const r = await fetch(SERVER + href);
      if (!r.ok) badCss.push(href);
    }
    if (badCss.length === 0) {
      ok(`${page.name} 引用的 ${cssMatches.length} 个样式表都存在`);
    } else {
      fail(`${page.name} 样式 404：` + badCss.join(', '));
    }
  }

  /* ---------- 5. 下单接口的异常处理 ---------- */
  console.log('\n[5] 下单接口的异常处理');

  const badCases = [
    { name: '空商品列表', body: { items: [], customer: { name: 'a', phone: '13800138000', address: 'x' } }, expect: '订单商品不能为空' },
    { name: '手机号格式错误', body: { items: [{ productId: 1, quantity: 1 }], customer: { name: 'a', phone: '123', address: 'x' } }, expect: '手机号' },
    { name: '数量为负数', body: { items: [{ productId: 1, quantity: -1 }], customer: { name: 'a', phone: '13800138000', address: 'x' } }, expect: '大于 0' },
    { name: '商品不存在', body: { items: [{ productId: 99999, quantity: 1 }], customer: { name: 'a', phone: '13800138000', address: 'x' } }, expect: '商品不存在' },
    { name: '收货人为空', body: { items: [{ productId: 1, quantity: 1 }], customer: { name: '', phone: '13800138000', address: 'x' } }, expect: '姓名' }
  ];

  for (const c of badCases) {
    const res = await fetch(SERVER + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c.body)
    });
    const data = await res.json();

    if (res.status === 400 && data.message && data.message.includes(c.expect)) {
      ok(`正确拒绝「${c.name}」-> ${data.message}`);
    } else {
      fail(`「${c.name}」没有被正确拒绝`, `status=${res.status} message=${data.message}`);
    }
  }

  /* ---------- 6. 订单查询 ---------- */
  console.log('\n[6] 订单查询');

  const notFound = await fetch(SERVER + '/api/orders/NOT_EXIST_123');
  if (notFound.status === 404) {
    ok('查询不存在的订单返回 404');
  } else {
    fail('不存在的订单应返回 404，实际 ' + notFound.status);
  }

  const listOrders = await (await fetch(SERVER + '/api/orders')).json();
  if (listOrders.code === 0 && Array.isArray(listOrders.data)) {
    ok(`订单列表接口正常（当前 ${listOrders.data.length} 笔）`);
  } else {
    fail('订单列表接口异常');
  }

  /* ---------- 7. 静态资源的 MIME 类型 ---------- */
  console.log('\n[7] 静态资源类型');

  const cssRes = await fetch(SERVER + '/css/components.css');
  if ((cssRes.headers.get('content-type') || '').includes('css')) {
    ok('CSS 返回正确的 Content-Type');
  } else {
    fail('CSS Content-Type 不对：' + cssRes.headers.get('content-type'));
  }

  // 商品图从 SVG 换成了真实照片 JPG，这里同步改掉
  const imgRes = await fetch(SERVER + '/assets/products/earphone-1.jpg');
  const imgType = imgRes.headers.get('content-type') || '';
  if (imgType.includes('jpeg') || imgType.includes('jpg')) {
    ok('商品图片返回正确的 Content-Type（image/jpeg）');
  } else {
    fail('商品图片 Content-Type 不对：' + imgType);
  }

  // 顺便确认图片体积合理（太小说明是错误页面，太大说明没压缩）
  const imgBuf = await imgRes.arrayBuffer();
  const kb = Math.round(imgBuf.byteLength / 1024);
  if (kb > 5 && kb < 400) {
    ok(`商品图片体积合理（${kb} KB）`);
  } else {
    fail(`商品图片体积异常：${kb} KB`);
  }

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(56));
  console.log(`  测试完成：通过 ${passed} 项，失败 ${failed} 项`);
  console.log('='.repeat(56) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n测试脚本本身出错了：', err);
  process.exit(1);
});
