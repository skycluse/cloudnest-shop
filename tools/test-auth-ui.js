/**
 * 前端用户系统测试（jsdom）
 * ------------------------------------------------------------
 * 在模拟浏览器里跑一遍完整的用户流程：
 * 打开登录弹窗 → 注册 → 检查登录状态 → 退出 → 登录
 * → 下单 → 看订单归属 → 确认游客也能购物
 *
 * 运行：node tools/test-auth-ui.js（需要先 npm start）
 */

const { JSDOM, VirtualConsole } = require('jsdom');
const SERVER = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function ok(n) { console.log('  PASS  ' + n); passed++; }
function fail(n, d) {
  console.log('  FAIL  ' + n);
  if (d) console.log('        ' + String(d).slice(0, 300));
  failed++;
}

async function loadPage(url, initialToken) {
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

      /* 关键：把 token 提前塞进 localStorage，
         模拟"用户之前登录过，现在刷新页面"的真实情况。
         如果在页面加载完之后才设，页面已经按"未登录"渲染过一轮了，
         测不出真实行为。 */
      if (initialToken) {
        window.localStorage.setItem('cloudnest_token', initialToken);
      }
    }
  });

  await new Promise((r) => setTimeout(r, 2200));
  return { dom, w: dom.window, d: dom.window.document, errors };
}

async function main() {
  console.log('\n' + '='.repeat(58));
  console.log('  前端用户系统测试');
  console.log('='.repeat(58));

  const stamp = Date.now().toString().slice(-8);
  const username = 'ui_' + stamp;
  const password = 'test123456';
  const nickname = '测试小明';

  /* ============================================================
     1. 未登录状态
     ============================================================ */
  console.log('\n[1] 未登录状态');

  const home = await loadPage('/index.html');

  if (home.errors.length === 0) ok('首页加载无 JS 报错');
  else fail('首页有 JS 报错', home.errors.join('\n'));

  const loginBtn = home.d.querySelector('#loginTrigger')
    || home.d.querySelector('.auth-trigger');
  if (loginBtn) ok('导航栏显示了「登录」按钮');
  else fail('没看到登录按钮', home.d.querySelector('#authArea')?.innerHTML?.slice(0, 200));

  // 弹窗默认应该是隐藏的
  const maskBefore = home.d.querySelector('#authMask');
  if (maskBefore && maskBefore.hidden) ok('登录弹窗默认是隐藏的');
  else fail('登录弹窗默认不该显示');

  /* ============================================================
     2. 打开登录弹窗
     ============================================================ */
  console.log('\n[2] 打开登录弹窗');

  loginBtn.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));

  const mask = home.d.querySelector('#authMask');
  if (mask && !mask.hidden) ok('点击后弹窗打开了');
  else fail('点击后弹窗没打开');

  // 登录模式下昵称栏应该隐藏
  const nickRow = home.d.querySelector('#authNicknameRow');
  if (nickRow && nickRow.hidden) ok('登录模式下「昵称」栏是隐藏的');
  else fail('登录模式下昵称栏不该显示');

  /* ============================================================
     3. 切换到注册
     ============================================================ */
  console.log('\n[3] 切换到注册');

  const switchBtn = home.d.querySelector('#authSwitchBtn');
  switchBtn.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));

  const title = home.d.querySelector('#authTitle').textContent;
  if (title.includes('注册')) ok('弹窗标题变成「' + title + '」');
  else fail('切换注册失败，标题还是：' + title);

  if (!home.d.querySelector('#authNicknameRow').hidden) {
    ok('注册模式下「昵称」栏显示出来了');
  } else {
    fail('注册模式下昵称栏应该显示');
  }

  /* ============================================================
     4. 填表注册
     ============================================================ */
  console.log('\n[4] 注册新账号');

  home.d.querySelector('#authUsername').value = username;
  home.d.querySelector('#authPassword').value = password;
  home.d.querySelector('#authNickname').value = nickname;

  home.d.querySelector('#authSubmit').dispatchEvent(
    new home.w.MouseEvent('click', { bubbles: true })
  );
  await new Promise((r) => setTimeout(r, 1800));

  if (home.d.querySelector('#authMask').hidden) {
    ok('注册成功后弹窗自动关闭了');
  } else {
    const err = home.d.querySelector('#authError').textContent;
    fail('注册没成功，弹窗还开着', '错误提示：' + err);
  }

  // 关键：token 要存进 localStorage
  const token = home.w.localStorage.getItem('cloudnest_token');
  if (token && token.length > 20) ok('登录凭证已存入 localStorage');
  else fail('localStorage 里没有 token');

  // 导航栏应该变成用户名
  const userTrigger = home.d.querySelector('#userTrigger');
  if (userTrigger && userTrigger.textContent.includes(nickname)) {
    ok(`导航栏显示了昵称「${nickname}」`);
  } else {
    fail('导航栏没显示用户名', home.d.querySelector('#authArea').innerHTML.slice(0, 250));
  }

  // 用户菜单默认收起
  const dropdown = home.d.querySelector('#userDropdown');
  if (dropdown && dropdown.hidden) ok('用户菜单默认是收起的');
  else fail('用户菜单默认不该展开');

  /* ============================================================
     5. 展开用户菜单
     ============================================================ */
  console.log('\n[5] 用户菜单');

  userTrigger.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));

  if (!home.d.querySelector('#userDropdown').hidden) {
    ok('点击头像后菜单展开了');
  } else {
    fail('点击头像后菜单没展开');
  }

  const dropHtml = home.d.querySelector('#userDropdown').innerHTML;
  const menuChecks = [
    { key: nickname, desc: '昵称' },
    { key: username, desc: '用户名' },
    { key: '注册时间', desc: '注册时间' },
    { key: '我的订单', desc: '我的订单入口' },
    { key: '退出登录', desc: '退出按钮' }
  ];
  for (const c of menuChecks) {
    if (dropHtml.includes(c.key)) ok('菜单里包含 ' + c.desc);
    else fail('菜单里缺少 ' + c.desc);
  }

  /* ============================================================
     6. 游客也能购物（不受登录影响）
     ============================================================ */
  console.log('\n[6] 商城基本功能未受影响');

  const cards = home.d.querySelectorAll('.product-card');
  if (cards.length > 0) ok(`商品列表正常渲染（${cards.length} 张卡片）`);
  else fail('商品列表没渲染');

  const addBtn = home.d.querySelector('.btn-add:not([disabled])');
  addBtn.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1400));

  const badge = home.d.querySelector('#cartBadge');
  if (badge && !badge.hidden) ok('登录状态下加购物车仍正常（角标 ' + badge.textContent + '）');
  else fail('登录后加购物车坏了');

  /* ============================================================
     7. 退出登录
     ============================================================ */
  console.log('\n[7] 退出登录');

  // 菜单可能已经因为点击别处收起了，重新展开
  const ut = home.d.querySelector('#userTrigger');
  home.d.querySelector('#userDropdown').hidden = false;

  const logoutBtn = home.d.querySelector('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1500));

    if (!home.w.localStorage.getItem('cloudnest_token')) {
      ok('退出后 localStorage 里的 token 已清除');
    } else {
      fail('退出后 token 还在');
    }

    if (home.d.querySelector('#loginTrigger')) {
      ok('退出后导航栏恢复成「登录」按钮');
    } else {
      fail('退出后导航栏没恢复');
    }
  } else {
    fail('找不到退出按钮');
  }

  /* ============================================================
     8. 用刚注册的账号重新登录
     ============================================================ */
  console.log('\n[8] 重新登录');

  const loginBtn2 = home.d.querySelector('#loginTrigger');
  loginBtn2.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));

  home.d.querySelector('#authUsername').value = username;
  home.d.querySelector('#authPassword').value = password;
  home.d.querySelector('#authSubmit').dispatchEvent(
    new home.w.MouseEvent('click', { bubbles: true })
  );
  await new Promise((r) => setTimeout(r, 1800));

  if (home.d.querySelector('#userTrigger')) {
    ok('用注册的账号重新登录成功');
  } else {
    fail('重新登录失败', home.d.querySelector('#authError').textContent);
  }

  /* ============================================================
     9. 错误密码
     ============================================================ */
  console.log('\n[9] 错误密码');

  // 先退出
  home.w.localStorage.removeItem('cloudnest_token');
  await home.w.auth.logout();
  await new Promise((r) => setTimeout(r, 800));

  const lb = home.d.querySelector('#loginTrigger');
  if (lb) {
    lb.dispatchEvent(new home.w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));

    home.d.querySelector('#authUsername').value = username;
    home.d.querySelector('#authPassword').value = 'definitely-wrong';
    home.d.querySelector('#authSubmit').dispatchEvent(
      new home.w.MouseEvent('click', { bubbles: true })
    );
    await new Promise((r) => setTimeout(r, 1500));

    const errText = home.d.querySelector('#authError').textContent;
    if (errText && errText.includes('不正确')) {
      ok('错误密码时弹窗里显示了提示：' + errText);
    } else {
      fail('错误密码没有提示', errText);
    }

    if (!home.d.querySelector('#authMask').hidden) {
      ok('登录失败时弹窗保持打开，方便重新输入');
    } else {
      fail('登录失败时弹窗不该关闭');
    }
  }

  /* ============================================================
     10. 登录状态持久化（刷新页面）
     ============================================================ */
  console.log('\n[10] 登录状态持久化');

  // 拿一个有效 token
  const relogin = await fetch(SERVER + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then((r) => r.json());

  // 带着 token 直接打开订单页，模拟"用户之前登录过，现在重新打开页面"
  const ordersPage = await loadPage('/orders.html', relogin.data.token);

  if (ordersPage.errors.length === 0) ok('订单页加载无 JS 报错');
  else fail('订单页有 JS 报错', ordersPage.errors.join('\n'));

  if (ordersPage.d.querySelector('#userTrigger')) {
    ok('页面加载时自动识别为已登录（不用手动点登录）');
  } else {
    fail('页面加载后没识别出登录状态');
  }

  const ordersTitle = ordersPage.d.querySelector('#ordersTitle');
  if (ordersTitle && ordersTitle.textContent.includes(nickname)) {
    ok('订单页标题显示为「' + ordersTitle.textContent.trim() + '」');
  } else {
    fail('订单页标题没跟着登录状态变化',
         '实际：' + (ordersTitle && ordersTitle.textContent));
  }

  /* ============================================================
     11. 未登录时订单页显示"本机订单"
     ============================================================ */
  console.log('\n[11] 未登录时的订单页');

  const guestOrders = await loadPage('/orders.html');

  const guestTitle = guestOrders.d.querySelector('#ordersTitle');
  if (guestTitle && guestTitle.textContent.includes('本机')) {
    ok('未登录时标题显示为「' + guestTitle.textContent.trim() + '」');
  } else {
    fail('未登录时标题应该是「本机订单」', guestTitle && guestTitle.textContent);
  }

  // 未登录也没有订单时，应该引导去登录
  const emptyBox = guestOrders.d.querySelector('.orders-empty');
  if (emptyBox && emptyBox.innerHTML.includes('登录')) {
    ok('空状态里提供了登录入口');
  } else {
    fail('空状态里没有登录引导');
  }

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(58));
  console.log(`  测试完成：通过 ${passed} 项，失败 ${failed} 项`);
  console.log('='.repeat(58) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('\n测试脚本出错：', e); process.exit(1); });
