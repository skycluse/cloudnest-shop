/* ============================================================
   icons.js —— 内联 SVG 图标库
   ------------------------------------------------------------
   【为什么不用 emoji 了？】
   emoji 的问题：
   1. 每个系统长得不一样（Windows 是彩色、Mac 是另一套、安卓又不同），
      所以不同电脑上看到的界面可能完全不同
   2. 颜色固定，没法跟着主题色变（比如悬浮时变紫色做不到）
   3. 大小、粗细不受控，和文字对齐经常差几个像素
   4. 观感偏随意，和正经的产品界面不搭

   【为什么用内联 SVG？】
   1. 是代码，不是字体/图片 → 不依赖网络，离线也能显示
   2. fill="currentColor" → 颜色自动跟随父元素的 color，
      所以鼠标悬浮变紫、深色模式变白，全都自动生效
   3. 矢量，放大不糊
   4. 可以精确控制大小和线宽

   【图标来源】
   Lucide（https://lucide.dev）—— 开源图标库，ISC 协议，可免费商用。
   下面是按需取用的图标路径数据。
   ============================================================ */

var ICON_PATHS = {
  /* ---------- 导航与通用 ---------- */
  package:
    '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',

  receipt:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',

  shoppingCart:
    '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',

  search:
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',

  sparkles:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',

  /* ---------- 操作类 ---------- */
  x:
    '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',

  plus:
    '<path d="M5 12h14"/><path d="M12 5v14"/>',

  minus:
    '<path d="M5 12h14"/>',

  trash:
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',

  send:
    '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',

  check:
    '<path d="M20 6 9 17l-5-5"/>',

  checkCircle:
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',

  alertCircle:
    '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',

  refresh:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',

  /* ---------- 状态类 ---------- */
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',

  shieldCheck:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',

  rotateCcw:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',

  mousePointer:
    '<path d="M12.586 12.586 19 19"/><path d="M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/>',

  /* ---------- 分类图标 ---------- */
  headphones:
    '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',

  keyboard:
    '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',

  mouse:
    '<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>',

  batteryCharging:
    '<path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M14 14v5.5a1.5 1.5 0 0 1-3 0V14"/><path d="M15 10H9"/><path d="M15 14H9"/>',

  lightbulb:
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',

  puzzle:
    '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>',

  /* ---------- 其它 ---------- */
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',

  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',

  messageCircle:
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',

  filter:
    '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',

  folderSearch:
    '<path d="M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4"/><circle cx="17" cy="17" r="3"/><path d="m21 21-1.9-1.9"/>',

  fileText:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
};

/**
 * 生成一个图标的 SVG 代码。
 *
 * @param {string} name 图标名（ICON_PATHS 里的键）
 * @param {number} size 尺寸，默认 20
 * @param {string} className 额外的 CSS 类名
 * @returns {string} SVG 的 HTML 字符串
 *
 * 【关键点：fill="none" + stroke="currentColor"】
 * - stroke="currentColor" 让描边颜色 = 父元素的文字颜色。
 *   所以鼠标悬浮时父元素 color 变成紫色，图标自动跟着变紫，不用额外写样式。
 * - fill="none" 因为是线性图标，只描边不填充。
 */
function icon(name, size, className) {
  var path = ICON_PATHS[name];

  // 图标名写错时不要静默失败，返回一个明显的问号占位，
  // 这样一眼就能看出是名字打错了，而不是默默什么都不显示
  if (!path) {
    console.warn('[icons] 未知图标名：' + name);
    path = ICON_PATHS.alertCircle;
  }

  var s = size || 20;
  var cls = className ? ' ' + className : '';

  return (
    '<svg class="icon-svg' + cls + '" width="' + s + '" height="' + s + '" ' +
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
    'focusable="false">' + path + '</svg>'
  );
}

/**
 * 把页面上所有带 data-icon 属性的元素替换成对应图标。
 *
 * 用法：在 HTML 里写 <span data-icon="shoppingCart" data-icon-size="20"></span>
 * 页面加载后调用 hydrateIcons()，它就会把内容填成 SVG。
 *
 * 为什么要用这种方式？
 * 因为 HTML 里直接写一大坨 SVG 代码会很乱、很难维护。
 * 用 data-icon="名字" 既简洁，又能统一控制尺寸和样式。
 */
function hydrateIcons(root) {
  var scope = root || document;
  var nodes = scope.querySelectorAll('[data-icon]');

  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];

    // 已经处理过的跳过（避免重复渲染）
    if (el.getAttribute('data-icon-done') === '1') continue;

    var name = el.getAttribute('data-icon');
    var size = parseInt(el.getAttribute('data-icon-size'), 10) || 20;
    el.innerHTML = icon(name, size);
    el.setAttribute('data-icon-done', '1');
  }
}

window.icons = {
  ICON_PATHS: ICON_PATHS,
  icon: icon,
  hydrate: hydrateIcons
};
