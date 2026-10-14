/**
 * 追踪 Agent 多轮对话的内部状态，定位"便宜一点"为什么没结果
 */
const { JSDOM, VirtualConsole } = require('jsdom');
const SERVER = 'http://localhost:3000';

async function main() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => console.log('[jsdomError]', e.message));
  vc.on('error', (...a) => console.log('[console.error]', ...a.map(String)));

  const html = await (await fetch(SERVER + '/index.html')).text();
  const dom = new JSDOM(html, {
    url: SERVER + '/index.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (input, init) => {
        const url = typeof input === 'string' && input.startsWith('/') ? SERVER + input : input;
        return fetch(url, init);
      };
      window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){},
        addEventListener(){}, removeEventListener(){} });
      window.scrollTo = () => {};
    }
  });

  await new Promise((r) => setTimeout(r, 2000));
  const w = dom.window;
  const agent = w.agent;

  console.log('=== 第一轮：推荐 1000 元以内机械键盘 ===');
  await agent.send('推荐一个 1000 元以内的机械键盘');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('lastQuery      :', JSON.stringify(agent.state.lastQuery));
  console.log('lastRecommended:', agent.state.lastRecommended.map((p) => `${p.id}:${p.name}:¥${p.price}`));

  console.log('\n=== 第二轮：有没有便宜一点的 ===');
  await agent.send('有没有便宜一点的？');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('lastQuery      :', JSON.stringify(agent.state.lastQuery));

  const bubbles = w.document.querySelectorAll('.msg-assistant .msg-bubble');
  console.log('\n最后一条回复：');
  console.log(bubbles[bubbles.length - 1].textContent);

  // 手动复现 refine 逻辑
  console.log('\n=== 手动复现 refine 逻辑 ===');
  const base = agent.state.lastQuery;
  console.log('base =', JSON.stringify(base));
  console.log('base.category =', base && base.category);
  console.log('base.keyword  =', base && base.keyword);

  const shownIds = agent.state.lastRecommended.map((p) => Number(p.id));
  console.log('shownIds =', shownIds);

  const highest = Math.max.apply(null, agent.state.lastRecommended.map((p) => Number(p.price)));
  console.log('highestPrice =', highest, '-> maxPrice =', highest - 1);

  const params = { category: base.category, sort: 'price_asc', pageSize: 50, maxPrice: highest - 1 };
  console.log('查询参数 =', JSON.stringify(params));
  const res = await w.api.getProducts(params);
  console.log('返回', res.total, '条:', res.items.map((p) => `${p.id}:¥${p.price}`));
  const fresh = res.items.filter((p) => shownIds.indexOf(Number(p.id)) === -1);
  console.log('过滤后剩下', fresh.length, '条:', fresh.map((p) => `${p.id}:¥${p.price}`));
}

main().catch(console.error);
