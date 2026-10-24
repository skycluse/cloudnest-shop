/**
 * 9.4 写入类工具测试（购物助手 + AI 客服）
 * ------------------------------------------------------------
 * 专门验证 9.4 的四条要求：
 *   1. Agent 能自主决定工具调用顺序，完成推荐 → 加购 → 下单
 *   2. 所有写操作执行前必须确认，不允许静默执行
 *   3. 工具调用后前端购物车、订单页状态实时同步
 *   4. 下单成功后用自然语言反馈订单编号、总价
 *
 * 两个 Agent 分开测，因为它们的实现是独立的。
 *
 * 运行：node tools/test-write-tools.js（需要先 npm start）
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

async function load(url, token) {
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
      if (token) window.localStorage.setItem('cloudnest_token', token);
    }
  });
  await new Promise((r) => setTimeout(r, 2400));
  return { w: dom.window, d: dom.window.document, errors };
}

/** 发消息并等回复 */
async function ask(page, bodyId, text, sendFn) {
  const before = page.d.querySelectorAll('#' + bodyId + ' .msg-assistant .msg-bubble').length;
  await sendFn(text);

  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const bs = page.d.querySelectorAll('#' + bodyId + ' .msg-assistant .msg-bubble');
    if (bs.length > before) return bs[bs.length - 1].textContent;
  }
  return '(无回复)';
}

async function main() {
  const stamp = Date.now().toString().slice(-8);

  console.log('\n' + '='.repeat(64));
  console.log('  9.4 写入类工具测试');
  console.log('='.repeat(64));

  /* ============================================================
     准备：两个独立账号，分别测两个 Agent
     ============================================================ */
  const regA = await fetch(SERVER + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'wa_' + stamp, password: 'test123456' })
  }).then((r) => r.json());

  const regB = await fetch(SERVER + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'wb_' + stamp, password: 'test123456' })
  }).then((r) => r.json());

  /* ============================================================
     A. 购物助手
     ============================================================ */
  console.log('\n【A】AI 购物助手（右下角浮窗）');

  const A = await load('/index.html', regA.data.token);
  A.w.agent.open();
  await new Promise((r) => setTimeout(r, 500));

  const askA = (t) => ask(A, 'agentBody', t, (x) => A.w.agent.send(x));

  /* ---------- 要求 1：自主决定工具顺序 ---------- */
  console.log('\n[1] 自主决定工具调用顺序');

  const recA = await askA('推荐一个500元以内的运动耳机');
  if (recA.includes('¥') && recA.includes('耳机')) {
    ok('第一步：调用 searchProducts，给出真实商品');
  } else {
    fail('推荐失败', recA.slice(0, 200));
  }

  // 记录推荐了哪些商品
  const recProductsA = A.d.querySelectorAll('#agentBody .msg-product-name');
  const recNamesA = Array.from(recProductsA).map((e) => e.textContent);
  if (recNamesA.length > 0) {
    ok(`推荐了 ${recNamesA.length} 个商品：${recNamesA[0]}...`);
  } else {
    fail('没有商品卡片');
  }

  /* ---------- 要求 2：写操作必须确认 ---------- */
  console.log('\n[2] 写操作执行前必须确认');

  const cartBeforeA = A.w.cart.getTotalCount();

  const buyA = await askA('帮我把刚才推荐的那款买了');
  if (buyA.includes('确认')) {
    ok('说"买了"时，先问确认，没有直接执行');
  } else {
    fail('没有请求确认', buyA.slice(0, 200));
  }

  // 关键：这时候购物车必须还是空的
  if (A.w.cart.getTotalCount() === cartBeforeA) {
    ok('等待确认期间，购物车没有被改动（没有静默执行）');
  } else {
    fail('购物车被提前改动了，违反了"必须确认"',
         `${cartBeforeA} -> ${A.w.cart.getTotalCount()}`);
  }

  // 回复里说明了要操作哪个商品
  if (buyA.includes(recNamesA[0])) {
    ok('确认时说明了具体商品：' + recNamesA[0]);
  } else {
    fail('确认信息里没说清是哪个商品', buyA.slice(0, 200));
  }

  /* ---------- 要求 3：加购（不带"买了"）—— 只加购，不自动下单 ---------- */
  console.log('\n[3] 加购类写操作：确认后加购，并且不自动下单');

  const addOnlyA = await askA('帮我把刚才推荐的那款加入购物车');
  if (addOnlyA.includes('确认')) {
    ok('"加入购物车"先请求确认');
  } else {
    fail('加购前没有确认', addOnlyA.slice(0, 200));
  }

  const cartBeforeAdd = A.w.cart.getTotalCount();
  const okA = await askA('确认');
  if (A.w.cart.getTotalCount() > cartBeforeAdd) {
    ok(`确认后购物车真的有了商品（${A.w.cart.getTotalCount()} 件）`);
  } else {
    fail('确认后购物车没变化', okA.slice(0, 200));
  }

  // 购物车抽屉应该被自动打开
  const drawerA = A.d.querySelector('#cartDrawer');
  if (drawerA && drawerA.classList.contains('is-open')) {
    ok('购物车抽屉自动打开了（界面实时同步）');
  } else {
    fail('购物车抽屉没有自动打开');
  }

  // 角标数字也要跟着变
  const badgeA = A.d.querySelector('#cartBadge');
  if (badgeA && !badgeA.hidden) {
    ok('购物车角标同步显示数量：' + badgeA.textContent);
  } else {
    fail('购物车角标没更新');
  }

  // 只是加购，不应该顺手产生订单
  if (!/CN\d{8,}-\d+/.test(okA)) {
    ok('只加购、没有静默下单');
  } else {
    fail('只说了加购，却产生了订单', okA.slice(0, 200));
  }

  /* ---------- 要求 4：下单反馈订单号 ---------- */
  console.log('\n[4] 下单成功后反馈订单编号和总价');

  const preOrderA = await askA('帮我下单');
  if (preOrderA.includes('确认')) {
    ok('下单前请求确认（列出购物车摘要）');
  } else {
    fail('下单前没有确认', preOrderA.slice(0, 200));
  }

  // 确认前不能有订单
  const ordersBeforeA = await fetch(SERVER + '/api/orders', {
    headers: { 'Authorization': 'Bearer ' + regA.data.token }
  }).then((r) => r.json());
  if (!ordersBeforeA.data || ordersBeforeA.data.length === 0) {
    ok('确认前没有生成订单（没有静默下单）');
  } else {
    fail('还没确认就产生了订单');
  }

  const doneA = await askA('确认');

  const orderNoA = (doneA.match(/CN\d{8,}-\d+/) || [])[0];
  if (orderNoA) {
    ok('下单回复里带了订单编号：' + orderNoA);
  } else {
    fail('下单回复里没有订单编号', doneA.slice(0, 300));
  }

  const priceA = (doneA.match(/¥[\d.]+/g) || [])[0];
  if (priceA) {
    ok('下单回复里带了总价：' + priceA);
  } else {
    fail('下单回复里没有总价');
  }

  if (doneA.includes('已支付')) {
    ok('下单回复里带了订单状态');
  } else {
    fail('下单回复里没有状态');
  }

  /* ---------- 要求 5：说"买了"时，加购 + 下单一次确认走完 ---------- */
  console.log('\n[5] 说"买了"：一次确认完成「加购 → 下单」');

  await askA('推荐一个 500 元以内的机械键盘');
  const buyNowReply = await askA('帮我把刚才推荐的那款买了');
  if (buyNowReply.includes('确认') && buyNowReply.includes('下单')) {
    ok('确认消息里说明了"先加购、再下单"');
  } else {
    fail('"买了"的确认消息没说清要做什么', buyNowReply.slice(0, 200));
  }

  const cartBeforeBuyNow = A.w.cart.getTotalCount();
  const ordersBeforeBuyNow = (await fetch(SERVER + '/api/orders', {
    headers: { 'Authorization': 'Bearer ' + regA.data.token }
  }).then((r) => r.json())).data.length;

  const buyNowDone = await askA('确认');
  const buyNowNo = (buyNowDone.match(/CN\d{8,}-\d+/) || [])[0];
  if (buyNowNo) {
    ok('一次确认后直接生成了订单：' + buyNowNo);
  } else {
    fail('一次确认后没有生成订单', buyNowDone.slice(0, 300));
  }

  const ordersAfterBuyNow = (await fetch(SERVER + '/api/orders', {
    headers: { 'Authorization': 'Bearer ' + regA.data.token }
  }).then((r) => r.json())).data;
  if (ordersAfterBuyNow.length === ordersBeforeBuyNow + 1) {
    ok('后端真的多了一笔订单（不是编的）');
  } else {
    fail('后端订单数没变化', `${ordersBeforeBuyNow} -> ${ordersAfterBuyNow.length}`);
  }

  if (A.w.cart.getTotalCount() === 0) {
    ok('下单后购物车被清空');
  } else {
    fail('下单后购物车没清空', '仍有 ' + A.w.cart.getTotalCount() + ' 件（确认前 ' + cartBeforeBuyNow + '）');
  }

  // 订单结果弹窗
  const resultA = A.d.querySelector('#resultMask');
  if (resultA && !resultA.hidden) {
    ok('订单结果弹窗自动弹出（界面实时同步）');
  } else {
    fail('订单结果弹窗没出现');
  }

  // 购物车已清空
  if (A.w.cart.isEmpty()) {
    ok('下单后购物车已清空');
  } else {
    fail('下单后购物车没清空');
  }

  // 后端真的存下了这笔订单
  const ordersAfterA = await fetch(SERVER + '/api/orders', {
    headers: { 'Authorization': 'Bearer ' + regA.data.token }
  }).then((r) => r.json());

  if (ordersAfterA.data && ordersAfterA.data.some((o) => o.id === orderNoA)) {
    ok('后端订单列表里能查到这笔订单（真实写入）');
  } else {
    fail('后端查不到这笔订单', JSON.stringify(ordersAfterA).slice(0, 200));
  }

  /* ---------- 未登录时的拦截 ---------- */
  console.log('\n[6] 未登录时写工具被拒绝');

  const guest = await load('/index.html');
  guest.w.agent.open();
  await new Promise((r) => setTimeout(r, 500));

  let addRejected = false;
  try {
    await guest.w.agent.tools.addToCart(1, 1);
  } catch (e) {
    addRejected = true;
    if (e.message.includes('登录')) ok('未登录 addToCart 被拒绝：' + e.message);
  }
  if (!addRejected) fail('未登录竟然能加购物车');

  let orderRejected = false;
  try {
    await guest.w.agent.tools.createOrder();
  } catch (e) {
    orderRejected = true;
    if (e.message.includes('登录')) ok('未登录 createOrder 被拒绝：' + e.message);
  }
  if (!orderRejected) fail('未登录竟然能下单');

  /* ============================================================
     B. AI 客服
     ============================================================ */
  console.log('\n【B】AI 客服（顶部入口）');

  const B = await load('/index.html', regB.data.token);
  B.d.querySelector('#supportTrigger').dispatchEvent(
    new B.w.MouseEvent('click', { bubbles: true })
  );
  await new Promise((r) => setTimeout(r, 600));

  const askB = (t) => ask(B, 'supportBody', t, (x) => B.w.support.send(x));

  /* ---------- 要求 1：多步工具顺序 ---------- */
  console.log('\n[7] 客服：自主决定工具调用顺序');

  const recB = await askB('推荐一个500元以内的耳机');
  if (recB.includes('¥')) {
    ok('第一步：查到真实商品');
  } else {
    fail('客服推荐失败', recB.slice(0, 200));
  }

  const recNamesB = Array.from(B.d.querySelectorAll('#supportBody .msg-product-name'))
    .map((e) => e.textContent);
  if (recNamesB.length >= 2) {
    ok(`推荐了 ${recNamesB.length} 个商品`);
  }

  /* ---------- 按序号指代 ---------- */
  console.log('\n[8] 客服：能听懂"买第二个"这类指代');

  const cartBeforeB = B.w.cart.getTotalCount();
  const pickB = await askB('帮我买第二个');

  if (pickB.includes('确认')) {
    ok('先请求确认');
  } else {
    fail('没有请求确认', pickB.slice(0, 200));
  }

  // 必须选中第 2 个商品，不是第 1 个
  if (recNamesB.length >= 2 && pickB.includes(recNamesB[1])) {
    ok('正确识别"第二个"：' + recNamesB[1]);
  } else {
    fail('没有正确识别"第二个"',
         `期望「${recNamesB[1]}」，回复：${pickB.slice(0, 200)}`);
  }

  if (B.w.cart.getTotalCount() === cartBeforeB) {
    ok('确认前购物车没被改动');
  } else {
    fail('确认前购物车就被改了');
  }

  /* ---------- 要求 3：状态同步 ---------- */
  console.log('\n[9] 客服：状态实时同步');

  await askB('确认');
  if (B.w.cart.getTotalCount() > 0) {
    ok(`加购成功，购物车 ${B.w.cart.getTotalCount()} 件`);
  } else {
    fail('客服加购没生效');
  }

  const drawerB = B.d.querySelector('#cartDrawer');
  if (drawerB && drawerB.classList.contains('is-open')) {
    ok('购物车抽屉自动打开');
  } else {
    fail('购物车抽屉没打开');
  }

  /* ---------- 要求 4：下单并反馈 ---------- */
  console.log('\n[10] 客服：下单并反馈订单信息');

  const preOrderB = await askB('帮我下单');
  if (preOrderB.includes('¥') && preOrderB.includes('确认')) {
    ok('下单前列出了购物车摘要并请求确认');
  } else {
    fail('下单摘要不完整', preOrderB.slice(0, 250));
  }

  const doneB = await askB('确认');

  const orderNoB = (doneB.match(/CN\d{8,}-\d+/) || [])[0];
  if (orderNoB) {
    ok('下单回复里带了订单编号：' + orderNoB);
  } else {
    fail('客服下单回复里没有订单编号', doneB.slice(0, 300));
  }

  if (/¥[\d.]+/.test(doneB)) {
    ok('下单回复里带了总价');
  } else {
    fail('没有总价');
  }

  const resultB = B.d.querySelector('#resultMask');
  if (resultB && !resultB.hidden) {
    ok('订单结果弹窗自动弹出');
  } else {
    fail('订单结果弹窗没出现');
  }

  // 客服能查到刚才下的这笔单
  const checkB = await askB('我的订单到哪了');
  if (checkB.includes(orderNoB)) {
    ok('客服能查到自己刚下的订单（数据真实）');
  } else {
    fail('客服查不到刚下的订单', checkB.slice(0, 250));
  }

  /* ---------- 客服未登录拦截 ---------- */
  console.log('\n[11] 客服：未登录时写工具被拒绝');

  const guestS = await load('/index.html');
  guestS.d.querySelector('#supportTrigger').dispatchEvent(
    new guestS.w.MouseEvent('click', { bubbles: true })
  );
  await new Promise((r) => setTimeout(r, 600));

  const guestBuy = await ask(guestS, 'supportBody', '帮我买个耳机', (x) => guestS.w.support.send(x));
  if (guestBuy.includes('登录')) {
    ok('客服未登录时提示先登录');
  } else {
    fail('客服未登录时没提示登录', guestBuy.slice(0, 200));
  }

  const guestOrder = await ask(guestS, 'supportBody', '帮我下单', (x) => guestS.w.support.send(x));
  if (guestOrder.includes('登录')) {
    ok('未登录下单被客服拦下');
  } else {
    fail('未登录竟然能下单', guestOrder.slice(0, 200));
  }

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(64));
  console.log(`  测试完成：通过 ${passed} 项，失败 ${failed} 项`);
  console.log('='.repeat(64) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('\n测试脚本出错：', e); process.exit(1); });
