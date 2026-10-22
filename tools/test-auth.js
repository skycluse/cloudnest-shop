/**
 * 用户系统接口测试
 * ------------------------------------------------------------
 * 覆盖：注册、登录、退出、获取用户信息，以及各种异常情况。
 *
 * 重点验证几件事：
 * 1. 密码不能明文存（检查 users.json）
 * 2. 接口不能返回 passwordHash / salt
 * 3. 重复注册、错误密码、未登录都要被正确拒绝
 * 4. 未登录也能下单（不影响商城基本流程）
 * 5. 登录后能只看到自己的订单
 *
 * 运行：node tools/test-auth.js（需要先 npm start）
 */

const fs = require('fs');
const path = require('path');

const SERVER = 'http://localhost:3000';
const USERS_FILE = path.join(__dirname, '..', 'server', 'data', 'users.json');

let passed = 0;
let failed = 0;

function ok(name) { console.log(`  PASS  ${name}`); passed++; }
function fail(name, detail) {
  console.log(`  FAIL  ${name}`);
  if (detail) console.log('        ' + String(detail).slice(0, 300));
  failed++;
}

async function api(method, url, body, token) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(SERVER + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let json = null;
  try { json = await res.json(); } catch (e) { /* 忽略 */ }
  return { status: res.status, body: json };
}

async function main() {
  console.log('\n' + '='.repeat(58));
  console.log('  用户系统测试');
  console.log('='.repeat(58));

  // 每次跑用不同用户名，避免和上次的数据冲突
  const stamp = Date.now().toString().slice(-8);
  const userA = 'alice_' + stamp;
  const userB = 'bob_' + stamp;
  const pwd = 'test123456';

  let tokenA = '';

  /* ============================================================
     1. 注册
     ============================================================ */
  console.log('\n[1] 注册');

  const regA = await api('POST', '/api/auth/register', {
    username: userA, password: pwd, nickname: '小A'
  });
  if (regA.status === 201 && regA.body.code === 0 && regA.body.data.token) {
    ok(`注册成功，用户名 ${userA}，直接返回了 token`);
    tokenA = regA.body.data.token;
  } else {
    fail('注册失败', JSON.stringify(regA.body));
  }

  // 昵称和用户名都对
  if (regA.body.data.user.nickname === '小A' && regA.body.data.user.username === userA) {
    ok('返回的用户信息正确（用户名 + 昵称）');
  } else {
    fail('用户信息不对', JSON.stringify(regA.body.data.user));
  }

  // 关键：不能返回密码相关字段
  const leaked = ['passwordHash', 'salt', 'password'].filter(
    (k) => regA.body.data.user && k in regA.body.data.user
  );
  if (leaked.length === 0) {
    ok('响应里没有泄露 passwordHash / salt');
  } else {
    fail('响应里泄露了敏感字段：' + leaked.join(', '));
  }

  /* ============================================================
     2. 密码必须加密存储
     ============================================================ */
  console.log('\n[2] 密码存储安全');

  if (fs.existsSync(USERS_FILE)) {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');

    if (raw.includes('"' + pwd + '"')) {
      fail('users.json 里出现了明文密码！');
    } else {
      ok('users.json 里没有明文密码');
    }

    const db = JSON.parse(raw);
    const u = db.users.find((x) => x.username === userA);
    if (u && u.passwordHash && u.passwordHash.length === 64 && u.salt) {
      ok('密码以 scrypt 哈希 + 独立盐值存储（64 位十六进制）');
    } else {
      fail('密码存储格式不对', JSON.stringify(u).slice(0, 200));
    }

    // 两个用户密码相同，但哈希应该不同（因为盐不同）
    const regB = await api('POST', '/api/auth/register', {
      username: userB, password: pwd, nickname: '小B'
    });
    const db2 = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const ua = db2.users.find((x) => x.username === userA);
    const ub = db2.users.find((x) => x.username === userB);

    if (ua && ub && ua.passwordHash !== ub.passwordHash) {
      ok('相同密码的两个用户哈希不同（盐值生效，能防彩虹表）');
    } else {
      fail('相同密码得到了相同哈希，盐值没起作用');
    }
  } else {
    fail('users.json 没有生成');
  }

  /* ============================================================
     3. 注册的异常情况
     ============================================================ */
  console.log('\n[3] 注册的异常处理');

  const badCases = [
    { name: '用户名太短', body: { username: 'ab', password: pwd }, expect: '3~20' },
    { name: '用户名有中文', body: { username: '张三三', password: pwd }, expect: '字母、数字' },
    { name: '密码太短', body: { username: 'ok_' + stamp, password: '123' }, expect: '至少 6 位' },
    { name: '用户名为空', body: { username: '', password: pwd }, expect: '请填写用户名' },
    { name: '重复用户名', body: { username: userA, password: pwd }, expect: '已经被注册' }
  ];

  for (const c of badCases) {
    const r = await api('POST', '/api/auth/register', c.body);
    if (r.status === 400 && r.body.message && r.body.message.includes(c.expect)) {
      ok(`正确拒绝「${c.name}」-> ${r.body.message}`);
    } else {
      fail(`「${c.name}」没有被正确拒绝`, `status=${r.status} msg=${r.body && r.body.message}`);
    }
  }

  /* ============================================================
     4. 登录
     ============================================================ */
  console.log('\n[4] 登录');

  const login = await api('POST', '/api/auth/login', { username: userA, password: pwd });
  if (login.status === 200 && login.body.code === 0 && login.body.data.token) {
    ok('用正确的用户名密码登录成功');
  } else {
    fail('登录失败', JSON.stringify(login.body));
  }

  const wrongPwd = await api('POST', '/api/auth/login', { username: userA, password: 'wrong-password' });
  if (wrongPwd.status === 400 && wrongPwd.body.message.includes('不正确')) {
    ok('密码错误被拒绝');
  } else {
    fail('密码错误没有被拒绝', JSON.stringify(wrongPwd.body));
  }

  const noUser = await api('POST', '/api/auth/login', { username: 'nobody_' + stamp, password: pwd });
  // 关键：提示语要和"密码错误"一致，不能暴露用户名是否存在
  if (noUser.status === 400 && noUser.body.message === wrongPwd.body.message) {
    ok('用户不存在和密码错误的提示一致（防止用户名枚举）');
  } else {
    fail('两种失败的提示不一样，会泄露用户名是否注册', 
         `密码错: ${wrongPwd.body.message} / 用户不存在: ${noUser.body.message}`);
  }

  /* ============================================================
     5. 获取当前用户（登录状态管理）
     ============================================================ */
  console.log('\n[5] 登录状态管理');

  const me = await api('GET', '/api/auth/me', null, tokenA);
  if (me.status === 200 && me.body.data && me.body.data.username === userA) {
    ok('带 token 请求 /api/auth/me 能拿到当前用户');
  } else {
    fail('获取当前用户失败', JSON.stringify(me.body));
  }

  const meNoToken = await api('GET', '/api/auth/me');
  if (meNoToken.status === 401) {
    ok('不带 token 时返回 401（前端据此显示登录按钮）');
  } else {
    fail('不带 token 应该返回 401，实际 ' + meNoToken.status);
  }

  const meBadToken = await api('GET', '/api/auth/me', null, 'not-a-real-token-123456');
  if (meBadToken.status === 401) {
    ok('伪造的 token 被拒绝');
  } else {
    fail('伪造 token 竟然通过了，安全问题！');
  }

  /* ============================================================
     6. 未登录也能下单（不影响商城基本流程）
     ============================================================ */
  console.log('\n[6] 游客下单（不登录也能买）');

  const guestOrder = await api('POST', '/api/orders', {
    items: [{ productId: 1, quantity: 1 }],
    customer: { name: '游客', phone: '13800138000', address: '测试地址 1 号' }
  });

  if (guestOrder.status === 201 && guestOrder.body.data) {
    ok('未登录可以正常下单（订单 userId 为 null）');
    if (guestOrder.body.data.userId === null) {
      ok('游客订单的 userId 确实为 null');
    } else {
      fail('游客订单的 userId 应该是 null', String(guestOrder.body.data.userId));
    }
  } else {
    fail('未登录下单失败，影响了基本流程', JSON.stringify(guestOrder.body));
  }

  /* ============================================================
     7. 登录后下单，订单归属正确
     ============================================================ */
  console.log('\n[7] 登录用户下单与订单归属');

  const userOrder = await api('POST', '/api/orders', {
    items: [{ productId: 3, quantity: 2 }],
    customer: { name: '小A', phone: '13900139000', address: '测试地址 2 号' }
  }, tokenA);

  let myOrderId = '';
  if (userOrder.status === 201 && userOrder.body.data.userId) {
    ok('登录后下单，订单记到了用户名下');
    myOrderId = userOrder.body.data.id;
  } else {
    fail('登录下单没有绑定用户', JSON.stringify(userOrder.body));
  }

  const myOrders = await api('GET', '/api/orders', null, tokenA);
  if (myOrders.body.data.length > 0 && myOrders.body.data.every((o) => o.userId === regA.body.data.user.id)) {
    ok(`查到了自己的 ${myOrders.body.data.length} 笔订单，全部属于自己`);
  } else {
    fail('我的订单列表不对', JSON.stringify(myOrders.body.data));
  }

  // 另一个用户不能看到小A的订单
  const loginB = await api('POST', '/api/auth/login', { username: userB, password: pwd });
  const bOrders = await api('GET', '/api/orders', null, loginB.body.data.token);
  if (bOrders.body.data.length === 0) {
    ok('用户B看不到用户A的订单（数据隔离正确）');
  } else {
    fail('用户B看到了别人的订单，数据泄漏！', String(bOrders.body.data.length));
  }

  /* ============================================================
     8. 未登录时的订单查询
     ============================================================ */
  console.log('\n[8] 未登录时的订单查询');

  const guestAll = await api('GET', '/api/orders');
  if (Array.isArray(guestAll.body.data) && guestAll.body.data.length === 0) {
    ok('未登录且不带订单号时返回空（不会泄露所有人的订单）');
  } else {
    fail('未登录竟然能拿到订单列表，隐私泄漏', JSON.stringify(guestAll.body.data).slice(0, 150));
  }

  const guestByIds = await api('GET', '/api/orders?ids=' + encodeURIComponent(guestOrder.body.data.id));
  if (guestByIds.body.data.length === 1 && guestByIds.body.data[0].id === guestOrder.body.data.id) {
    ok('带上本机订单号可以查回自己的游客订单');
  } else {
    fail('按订单号查游客订单失败', JSON.stringify(guestByIds.body.data).slice(0, 150));
  }

  /* ============================================================
     9. 退出登录
     ============================================================ */
  console.log('\n[9] 退出登录');

  const logout = await api('POST', '/api/auth/logout', null, tokenA);
  if (logout.status === 200 && logout.body.code === 0) {
    ok('退出接口返回成功');
  } else {
    fail('退出失败', JSON.stringify(logout.body));
  }

  // 关键：退出之后这个 token 必须失效
  const afterLogout = await api('GET', '/api/auth/me', null, tokenA);
  if (afterLogout.status === 401) {
    ok('退出后旧 token 立即失效');
  } else {
    fail('退出后 token 还能用，安全问题！', 'status=' + afterLogout.status);
  }

  /* ============================================================
     10. 商城核心功能没被影响
     ============================================================ */
  console.log('\n[10] 商城基本功能未受影响');

  const products = await api('GET', '/api/products');
  if (products.body.data.total === 24) {
    ok('商品列表正常（24 件）');
  } else {
    fail('商品列表异常', String(products.body.data && products.body.data.total));
  }

  const search = await api('GET', '/api/products?keyword=' + encodeURIComponent('耳机'));
  if (search.body.data.total > 0) {
    ok(`搜索功能正常（"耳机" ${search.body.data.total} 件）`);
  } else {
    fail('搜索功能坏了');
  }

  const detail = await api('GET', '/api/products/1');
  if (detail.body.data && detail.body.data.id === 1) {
    ok('商品详情正常');
  } else {
    fail('商品详情坏了');
  }

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(58));
  console.log(`  测试完成：通过 ${passed} 项，失败 ${failed} 项`);
  console.log('='.repeat(58) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n测试脚本出错：', err);
  process.exit(1);
});
