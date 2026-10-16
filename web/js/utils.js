/* ============================================================
   utils.js —— 通用小工具函数
   ------------------------------------------------------------
   这里全部都是"函数"：进去一个东西，出来一个东西。
   没有副作用、不依赖外部状态，所以任何页面都能放心用。
   ============================================================ */

/**
 * 用选择器找元素（找不到返回 null）
 * 简称 $，和 jQuery 的用法类似
 * @param {string} selector CSS 选择器，如 '#productGrid' 或 '.product-card'
 * @param {Element} parent 在哪个父元素里找，不传就是整个文档
 */
function $(selector, parent) {
  return (parent || document).querySelector(selector);
}

/**
 * 找多个元素，返回真正的数组（querySelectorAll 返回的是 NodeList，
 * NodeList 没有 forEach 之外的一些数组方法，转成数组更好用）
 */
function $$(selector, parent) {
  var list = (parent || document).querySelectorAll(selector);
  return Array.prototype.slice.call(list);
}

/**
 * 格式化价格：299 -> "299.00"
 * toFixed(2) 表示保留两位小数
 */
function formatPrice(value) {
  var num = Number(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * 格式化价格并带上 ¥ 符号：299 -> "¥299.00"
 */
function formatPriceCny(value) {
  return '¥' + formatPrice(value);
}

/**
 * 格式化日期时间
 * '2026-10-14T05:24:42.735Z' -> '2026-10-14 13:24:42'
 *
 * 注意：后端存的是 ISO 字符串（带 Z，表示 UTC 时间），
 * new Date() 会自动转成本地时区，所以这里取出来就是北京时间。
 */
function formatDateTime(isoString) {
  if (!isoString) return '-';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';

  // 补零函数：5 -> "05"
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  );
}

/**
 * 把 45 秒前 变成 "45 秒前"、"3 分钟前" 这种更好读的形式
 */
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  var diff = Date.now() - new Date(isoString).getTime();
  var seconds = Math.floor(diff / 1000);

  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' 分钟前';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' 小时前';
  if (seconds < 2592000) return Math.floor(seconds / 86400) + ' 天前';
  return formatDateTime(isoString).slice(0, 10);
}

/**
 * HTML 转义 —— 【这是安全相关的，很重要！】
 *
 * 如果直接把商品名塞进 innerHTML，而商品名里含有 <script>，
 * 那这个脚本就会在用户浏览器里执行，这叫 XSS 攻击。
 * 商品数据虽然是我们自己准备的，但养成习惯很重要。
 *
 * 原理：把有特殊含义的符号换成"实体编码"，浏览器就会当普通文字显示。
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 防抖（debounce）：短时间内连续触发，只执行最后一次。
 * 用途：搜索框边输入边搜索，不加防抖的话每敲一个字就发一次请求。
 *
 * 【闭包是什么？就是这里的 timer】
 * 函数 return 出去之后，里面的 timer 变量依然"活着"，
 * 每次调用都能读到上次的值 —— 这就是闭包。
 *
 * @param {Function} fn 要执行的函数
 * @param {number} delay 延迟毫秒数
 */
function debounce(fn, delay) {
  var timer = null;

  return function () {
    var args = arguments;      // 保存调用时传的参数
    var context = this;

    clearTimeout(timer);       // 取消上一次还没执行的
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
}

/**
 * 简单的节流（throttle）：限制一段时间内最多执行一次。
 * 用途：监听 scroll 事件，不节流会疯狂触发，页面卡顿。
 */
function throttle(fn, interval) {
  var lastTime = 0;

  return function () {
    var now = Date.now();
    if (now - lastTime < interval) return;
    lastTime = now;
    fn.apply(this, arguments);
  };
}

/**
 * 生成星级评分的 HTML：4.6 -> 5 颗星（4 颗实心 + 1 颗空心）
 *
 * 为什么改用 SVG 星星而不是 ★☆ 文字符号？
 * ★☆ 虽然不算 emoji，但也有和 emoji 一样的问题：
 * 不同系统、不同字体的星星粗细和间距都不一样，对不齐。
 * 用 SVG 能精确控制大小、间距和颜色。
 *
 * 返回的是 HTML 字符串，调用处要用 innerHTML 插入（不是 textContent）。
 */
function renderStars(rating) {
  var score = Number(rating) || 0;
  var full = Math.floor(score);
  var html = '';

  for (var i = 0; i < 5; i++) {
    var filled = i < full;
    html +=
      '<svg class="star' + (filled ? ' is-filled' : '') + '" width="13" height="13" ' +
      'viewBox="0 0 24 24" ' +
      'fill="' + (filled ? 'currentColor' : 'none') + '" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
      '</svg>';
  }

  return '<span class="stars">' + html + '</span>';
}

/**
 * 根据库存显示状态文字和样式类
 */
function getStockInfo(stock) {
  var n = Number(stock) || 0;
  if (n <= 0) return { text: '已售罄', cls: 'stock-out', available: false };
  if (n <= 10) return { text: '仅剩 ' + n + ' 件', cls: 'stock-low', available: true };
  return { text: '现货充足', cls: 'stock-ok', available: true };
}

/* ============================================================
   弹提示（Toast）
   ============================================================ */

/**
 * 屏幕下方弹一条提示，2.4 秒后自动消失。
 * @param {string} message 提示文字
 * @param {string} type 'info' | 'success' | 'error'
 */
function toast(message, type) {
  var wrap = $('#toastWrap');
  if (!wrap) return;

  var el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'info');
  el.textContent = message;      // 用 textContent 而不是 innerHTML，天然防 XSS
  wrap.appendChild(el);

  // 2.4 秒后加动画类，再等动画播完把它删掉
  setTimeout(function () {
    el.classList.add('is-out');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 250);
  }, 2400);
}

/* ============================================================
   其它小工具
   ============================================================ */

/**
 * 读取地址栏上的查询参数
 * 地址是 index.html?keyword=耳机  ->  getUrlParam('keyword') 返回 '耳机'
 */
function getUrlParam(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

/**
 * 平滑滚动到某个元素
 */
function scrollToElement(selector) {
  var el = $(selector);
  if (!el) return;
  var headerHeight = 72;         // 顶部导航栏会挡住内容，所以要往上偏一点
  var top = el.getBoundingClientRect().top + window.pageYOffset - headerHeight;
  window.scrollTo({ top: top, behavior: 'smooth' });
}

/**
 * 把数字限制在 [min, max] 范围内
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* ============================================================
   图片加载失败兜底
   ------------------------------------------------------------
   【为什么需要这个？】

   订单里存的是"下单当时的商品快照"（包括图片路径）。
   这是对的设计 —— 商品以后改价下架，历史订单还能显示当时的样子。

   但副作用是：如果图片文件被换了名字或删了（比如我们把商品图
   从 .svg 全部换成 .jpg），**已经存在的历史订单就会图片 404**，
   页面上出现一个破图图标，很难看。

   解决方案有两层：
   1. 数据层：写脚本修好历史订单里的路径（tools/fix_order_images.py）
   2. 展示层：万一还是加载失败，用一个占位图标兜住，不让破图露出来

   第 2 层是防御性编程 —— 数据总会因为各种原因出问题，
   界面不能因此就崩掉或难看。
   ============================================================ */

/**
 * 图片加载失败时，把 src 换成一张内嵌的占位图。
 *
 * @param {Element} imgEl 出错的 img 元素
 */
function applyImageFallback(imgEl) {
  if (!imgEl || imgEl.getAttribute('data-fallback-done') === '1') return;

  // 打标记，避免占位图万一也失败时无限循环
  imgEl.setAttribute('data-fallback-done', '1');

  // 用内联 SVG（data URI）做占位：
  // 它写在代码里，永远不会 404，作为兜底最可靠。
  imgEl.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
        '<rect width="64" height="64" fill="#f3f4f6"/>' +
        '<g fill="none" stroke="#d1d5db" stroke-width="2.5" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="14" y="18" width="36" height="28" rx="3"/>' +
          '<circle cx="24" cy="28" r="3"/>' +
          '<path d="M50 40 38 30 22 46"/>' +
        '</g>' +
      '</svg>'
    );

  imgEl.classList.add('img-fallback');
}

/**
 * 全局兜底：任何图片加载失败都换成占位图。
 *
 * 【关键点：必须用捕获阶段（第三个参数 true）】
 * 因为 error 事件**不会冒泡**，
 * 在 document 上用普通的冒泡监听是抓不到的，
 * 只有捕获阶段才能拦到所有图片的加载失败。
 *
 * 这样不管图片是 HTML 里写死的、还是 JS 动态插入的，全都能兜住，
 * 不用给每个 <img> 单独绑事件。
 */
function initImageFallback() {
  document.addEventListener(
    'error',
    function (event) {
      var target = event.target;
      if (target && target.tagName === 'IMG') {
        applyImageFallback(target);
      }
    },
    true   // ← 捕获阶段
  );
}

// 挂到 window，供其它文件使用
window.utils = {
  $: $,
  $$: $$,
  formatPrice: formatPrice,
  formatPriceCny: formatPriceCny,
  formatDateTime: formatDateTime,
  formatRelativeTime: formatRelativeTime,
  escapeHtml: escapeHtml,
  debounce: debounce,
  throttle: throttle,
  renderStars: renderStars,
  getStockInfo: getStockInfo,
  toast: toast,
  getUrlParam: getUrlParam,
  scrollToElement: scrollToElement,
  clamp: clamp,
  applyImageFallback: applyImageFallback,
  initImageFallback: initImageFallback
};
