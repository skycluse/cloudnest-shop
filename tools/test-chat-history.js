/**
 * 9.7 会话持久化 / 上下文管理测试
 * ------------------------------------------------------------
 * 专门验证 9.7 里的两条：
 *   6. 会话持久化：对话历史在页面刷新或重新打开后不丢失
 *   4. 上下文管理：合理控制历史长度，不会无限增长
 *
 * 测法：用 jsdom 真正跑页面 JS
 *   1) 在第一个页面里聊一轮，读出 localStorage 里存了什么
 *   2) 用这份数据作为"上次留下的记录"，开第二个页面（相当于刷新）
 *   3) 检查历史有没有被还原、多轮追问还能不能接着上一轮推荐
 *
 * 运行：node tools/test-chat-history.js（需要先 npm start）
 */

const { JSDOM, VirtualConsole } = require('jsdom');
const SERVER = 'http://localhost:3000';
const KEY = 'cloudnest_agent_chat_v1';

let passed = 0;
let failed = 0;

function ok(n) { console.log('  PASS  ' + n); passed++; }
function fail(n, d) {
  console.log('  FAIL  ' + n);
  if (d) console.log('        ' + String(d).slice(0, 400));
  failed++;
}

/**
 * 打开首页
 * @param {string} seed 预置的聊天记录（模拟"上次打开留下的 localStorage"）
 */
async function load(seed) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

  const html = await (await fetch(SERVER + '/')).text();
  const dom = new JSDOM(html, {
    url: SERVER + '/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (i, init) => fetch(
        typeof i === 'string' && i.startsWith('/') ? SERVER + i : i, init);
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {} });
      window.scrollTo = () => {};
      if (seed) window.localStorage.setItem(KEY, seed);
    }
  });
  await new Promise((r) => setTimeout(r, 2400));
  return { w: dom.window, d: dom.window.document, errors };
}

/** 发一条消息，等回复出现 */
async function ask(page, text) {
  const before = page.d.querySelectorAll('#agentBody .msg-assistant .msg-bubble').length;
  await page.w.agent.send(text);

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const bs = page.d.querySelectorAll('#agentBody .msg-assistant .msg-bubble');
    if (bs.length > before) return bs[bs.length - 1].textContent;
  }
  return '(无回复)';
}

async function main() {
  console.log('\n' + '='.repeat(64));
  console.log('  9.7 会话持久化 / 上下文管理测试');
  console.log('='.repeat(64));

  /* ========== 1. 第一轮对话，检查有没有存下来 ========== */
  console.log('\n[1] 对话结束后写入 localStorage');

  const p1 = await load();
  if (!p1.w.agent) {
    fail('页面里的 agent 没初始化');
    process.exit(1);
  }

  await ask(p1, '推荐一个 1000 元以内的机械键盘');

  const raw = p1.w.localStorage.getItem(KEY);
  if (!raw) {
    fail('聊完没有往 localStorage 写记录');
  } else {
    ok('聊完写入了 localStorage');

    const saved = JSON.parse(raw);
    if (saved.messages.length >= 2) ok('存了用户消息和助手回复（' + saved.messages.length + ' 条）');
    else fail('历史条数不对', JSON.stringify(saved.messages));

    if (Array.isArray(saved.lastRecommended) && saved.lastRecommended.length > 0) {
      ok('把上一轮推荐商品也存了下来（' + saved.lastRecommended.length + ' 件）');
    } else {
      fail('没有存 lastRecommended，刷新后"便宜一点"会断片');
    }

    if (!saved.hasOwnProperty('pendingAction')) {
      ok('没有把待确认的写操作存下来（刷新后必须重新确认，更安全）');
    } else {
      fail('把 pendingAction 也存进了本地，刷新后可能被静默执行');
    }
  }

  /* ========== 2. 新开一个页面（= 刷新），检查历史还原 ========== */
  console.log('\n[2] 重新打开页面后还原历史');

  const p2 = await load(p1.w.localStorage.getItem(KEY));

  if (p2.w.agent.state.messages.length > 0) ok('内存里的历史被还原');
  else fail('重新打开后历史是空的');

  p2.w.agent.open();
  await new Promise((r) => setTimeout(r, 300));

  const bubbles = p2.d.querySelectorAll('#agentBody .msg').length;
  const expect = p2.w.agent.state.messages.length;
  if (bubbles === expect && bubbles >= 2) {
    ok('界面上重绘出 ' + bubbles + ' 条消息，和存下来的历史一致');
  } else {
    fail('界面重绘的消息数和历史对不上', bubbles + ' vs ' + expect);
  }

  const cards = p2.d.querySelectorAll('#agentBody .msg-product').length;
  if (cards > 0) ok('商品卡片也一起还原了（' + cards + ' 张）');
  else fail('历史里的商品卡片丢了');

  if (p2.errors.length === 0) ok('还原过程没有 JS 报错');
  else fail('还原时页面报错', p2.errors.join(' | '));

  /* ========== 3. 刷新后多轮追问还能接上 ========== */
  console.log('\n[3] 刷新后说"便宜一点的"仍能接着上一轮');

  const pricesBefore = p2.w.agent.state.lastRecommended.map((p) => p.price);
  const reply = await ask(p2, '有没有便宜一点的');
  const pricesAfter = p2.w.agent.state.lastRecommended.map((p) => p.price);

  if (pricesAfter.length > 0 && Math.max(...pricesAfter) < Math.max(...pricesBefore)) {
    ok('新推荐确实更便宜（' + JSON.stringify(pricesBefore) + ' → ' + JSON.stringify(pricesAfter) + '）');
  } else {
    fail('刷新后追问没有变便宜', reply.slice(0, 200));
  }

  if (reply.indexOf('多少钱') === -1 && reply.indexOf('想买什么') === -1) {
    ok('没有把"便宜一点"当成新问题反问用户');
  } else {
    fail('把追问当成了全新需求');
  }

  /* ========== 4. 上下文长度有上限 ========== */
  console.log('\n[4] 长对话裁剪上下文');

  for (let i = 0; i < 10; i++) {
    await ask(p2, '你好');
  }

  const after = p2.w.agent.state.messages.length;
  if (after <= 20) ok('历史被裁剪到上限以内（' + after + ' 条）');
  else fail('历史无限增长（' + after + ' 条）');

  const savedAfter = JSON.parse(p2.w.localStorage.getItem(KEY)).messages.length;
  if (savedAfter <= 20) ok('本地存储里也只保留 ' + savedAfter + ' 条');
  else fail('本地存储无限增长（' + savedAfter + ' 条）');

  /* ========== 5. 清空对话 ========== */
  console.log('\n[5] 清空对话');

  p2.d.getElementById('agentClear').click();
  await new Promise((r) => setTimeout(r, 200));

  const left = p2.d.querySelectorAll('#agentBody .msg').length;
  if (left === 1) ok('界面上只剩下一条欢迎语');
  else fail('清空后界面还有 ' + left + ' 条消息');

  if (p2.w.agent.state.messages.length === 1) ok('内存里的历史也清空了');
  else fail('内存里还剩 ' + p2.w.agent.state.messages.length + ' 条');

  const stored = JSON.parse(p2.w.localStorage.getItem(KEY) || '{"messages":[]}');
  if (stored.messages.length === 1) ok('localStorage 里只留欢迎语（下次打开不会翻出旧对话）');
  else fail('localStorage 没清干净', stored.messages.length);

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(64));
  console.log(`  测试完成：通过 ${passed} 项，失败 ${failed} 项`);
  console.log('='.repeat(64) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('\n测试脚本出错：', e); process.exit(1); });
