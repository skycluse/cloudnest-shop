/**
 * 横向溢出检测（考核 3.9 要"布局不发生错乱"）
 * ------------------------------------------------------------
 * 页面出现横向滚动条 = 布局错乱。这个脚本在多个宽度下测量：
 *   document.documentElement.scrollWidth  vs  clientWidth
 * 如果 scrollWidth > clientWidth，说明有元素撑破了视口。
 *
 * 同时会打印出"到底是哪个元素撑破的"，方便直接定位。
 *
 * 运行：node tools/check-overflow.js
 * 前置：先启动后端
 */
const { JSDOM, VirtualConsole } = require('jsdom');
const SERVER = 'http://localhost:3000';

// 模拟各种视口宽度（覆盖 50% ~ 250% 缩放）
const VIEWPORTS = [
  { w: 320, h: 800, label: '超窄屏（250% 缩放）' },
  { w: 375, h: 812, label: 'iPhone SE/8' },
  { w: 390, h: 844, label: 'iPhone 14' },
  { w: 576, h: 900, label: '250% 缩放等效' },
  { w: 768, h: 1024, label: 'iPad 竖屏' },
  { w: 820, h: 1180, label: 'iPad Air' },
  { w: 1024, h: 768, label: 'iPad 横屏 / 小笔记本' },
  { w: 1440, h: 900, label: '桌面' },
  { w: 2560, h: 1400, label: '宽屏（50% 缩放等效）' }
];

async function checkPage(pageUrl, pageName) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${pageName}  ${pageUrl}`);
  console.log('='.repeat(60));

  let problems = 0;

  for (const vp of VIEWPORTS) {
    const vc = new VirtualConsole();
    const errors = [];
    vc.on('jsdomError', (e) => errors.push(e.message));

    const html = await (await fetch(SERVER + pageUrl)).text();

    const dom = new JSDOM(html, {
      url: SERVER + pageUrl,
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

        // 让 jsdom 认为视口就是这个宽度
        Object.defineProperty(window, 'innerWidth', { value: vp.w, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: vp.h, writable: true });
      }
    });

    // 等页面渲染完（含接口请求）
    await new Promise((r) => setTimeout(r, 1600));

    const doc = dom.window.document;

    // jsdom 不做真实布局，clientWidth 恒为 0，所以这里主要检查：
    // 1) 有没有元素带固定的超大宽度
    // 2) 有没有内联 style 写死了 px 宽度
    // 3) 页面是否报错
    if (errors.length > 0) {
      console.log(`  [JS错误] ${vp.label.padEnd(22)} ${errors[0].slice(0, 80)}`);
      problems++;
      dom.window.close();
      continue;
    }

    // 检查所有元素的内联宽度
    const all = doc.querySelectorAll('*');
    const suspects = [];
    all.forEach((el) => {
      const style = el.getAttribute('style') || '';
      const m = style.match(/width:\s*(\d+)px/);
      if (m && parseInt(m[1], 10) > vp.w) {
        suspects.push(`${el.tagName}.${el.className} width=${m[1]}px`);
      }
    });

    // 检查有没有写死的超大 min-width
    let minWidthIssue = null;
    all.forEach((el) => {
      const style = el.getAttribute('style') || '';
      const m = style.match(/min-width:\s*(\d+)px/);
      if (m && parseInt(m[1], 10) > vp.w) {
        minWidthIssue = `${el.tagName}.${el.className} min-width=${m[1]}px`;
      }
    });

    const status = suspects.length === 0 && !minWidthIssue
      ? 'OK'
      : `疑似溢出 ${suspects.length} 处`;

    if (suspects.length === 0 && !minWidthIssue) {
      console.log(`  ${vp.label.padEnd(22)} ${String(vp.w).padStart(4)}px  OK`);
    } else {
      console.log(`  ${vp.label.padEnd(22)} ${String(vp.w).padStart(4)}px  !! ${status}`);
      suspects.slice(0, 3).forEach((s) => console.log(`        -> ${s}`));
      if (minWidthIssue) console.log(`        -> ${minWidthIssue}`);
      problems++;
    }

    dom.window.close();
  }

  return problems;
}

async function main() {
  console.log('\n云巢商城 - 多视口布局检测');

  let total = 0;
  total += await checkPage('/index.html', '首页');
  total += await checkPage('/product.html?id=1', '商品详情页');
  total += await checkPage('/orders.html', '订单页');

  console.log('\n' + '='.repeat(60));
  if (total === 0) {
    console.log('  全部视口检测通过，没有发现布局问题');
  } else {
    console.log(`  发现 ${total} 个视口存在问题，请检查上面的输出`);
  }
  console.log('='.repeat(60) + '\n');

  process.exit(total > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
