/* ============================================================
   api.js —— 统一封装"向后端要数据"
   ------------------------------------------------------------
   【你要理解的核心概念：前端怎么和后端说话】

   1. 前端用 fetch() 发一个 HTTP 请求，比如 GET /api/products
   2. 后端 express 收到请求，去 store.js 里查数据
   3. 后端把数据变成 JSON 字符串发回来
   4. 前端的 fetch 拿到响应，用 .json() 把字符串变回对象
   5. 我们把对象交给页面渲染成 HTML

   为什么要封装成这些函数？
   如果不封装，每个页面都要写一遍 fetch(...).then(...).catch(...)，
   又长又容易写错。封装之后页面里只要写：
       const data = await api.getProducts({ keyword: '耳机' });
   干净得多，出错也只在一个地方改。
   ============================================================ */

// 后端接口的前缀。因为前端和后端在同一个地址下，所以直接写 /api 就行
var API_BASE = '/api';

/**
 * 最基础的请求函数，其它函数都调用它。
 *
 * @param {string} path    接口路径，如 '/products'
 * @param {object} options fetch 的配置（method、body 等）
 * @returns {Promise<any>} 成功时返回 data 部分，失败时抛出 Error
 *
 * 【async / await 是什么？】
 * async 表示"这个函数里会有需要等待的操作"。
 * await 表示"在这里等一下，等结果回来再往下走"。
 * 没有 await 的话，fetch 会立刻返回一个"还没好的 Promise"，
 * 你拿不到真正的数据。这是新手最容易踩的坑。
 */
async function request(path, options) {
  var config = options || {};
  config.headers = config.headers || {};

  // 如果有 body 且是对象，说明是 POST 提交数据，转成 JSON 字符串
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
    config.headers['Content-Type'] = 'application/json';
  }

  /* ---- 带上登录凭证 ----
     登录成功后我们把 token 存在 localStorage，
     之后每个请求都自动放进请求头，后端靠它判断"你是谁"。

     为什么每次请求都要带？
     因为 HTTP 本身是"无状态"的 —— 服务端不会记得上一个请求是谁发的。
     所以要么每次带上凭证，要么用 cookie（浏览器自动带）。
     这里用请求头的方式，逻辑更直白，也方便调试。 */
  var token = getStoredToken();
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = 'Bearer ' + token;
  }

  var response;
  try {
    response = await fetch(API_BASE + path, config);
  } catch (networkError) {
    // 走到这里说明连服务器都没连上（比如后端没启动）
    throw new Error('无法连接服务器，请确认后端已启动（npm start）');
  }

  // 后端返回的一定是 JSON，先解析出来
  var result;
  try {
    result = await response.json();
  } catch (parseError) {
    throw new Error('服务器返回的数据格式不正确（HTTP ' + response.status + '）');
  }

  // 我们的约定：code === 0 才算成功，其它都当失败
  if (result.code !== 0) {
    var error = new Error(result.message || ('请求失败（HTTP ' + response.status + '）'));
    error.code = result.code;
    error.status = response.status;
    throw error;
  }

  return result.data;
}

/* ============================================================
   登录凭证的存取
   ------------------------------------------------------------
   存在 localStorage 里，刷新页面还在，关掉浏览器再打开也还在，
   直到用户主动退出、或者 token 过期（后端设了 7 天）。
   ============================================================ */

var TOKEN_KEY = 'cloudnest_token';

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (err) {
    return '';
  }
}

function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('保存登录状态失败：', err);
  }
}

/* ============================================================
   商品相关
   ============================================================ */

/**
 * 查商品列表。参数都是可选的，不传就查全部。
 * @param {object} params { keyword, category, minPrice, maxPrice, sort, page, pageSize }
 * @returns {Promise<{items, total, page, pageSize, totalPages}>}
 */
function getProducts(params) {
  var query = buildQueryString(params);
  return request('/products' + query);
}

/**
 * 查单个商品详情
 * @param {number|string} id 商品 id
 */
function getProduct(id) {
  return request('/products/' + id);
}

/**
 * 查所有分类
 */
function getCategories() {
  return request('/categories');
}

/* ============================================================
   订单相关
   ============================================================ */

/**
 * 创建订单
 * @param {object} payload { items: [{productId, quantity}], customer: {...}, remark }
 */
function createOrder(payload) {
  return request('/orders', { method: 'POST', body: payload });
}

/**
 * 查订单详情
 * @param {string} id 订单编号
 */
function getOrder(id) {
  return request('/orders/' + encodeURIComponent(id));
}

/**
 * 查订单列表（只返回当前登录用户的订单，未登录会返回 401）
 */
function getOrders() {
  return request('/orders');
}

/* ============================================================
   用户相关
   ============================================================ */

/**
 * 注册。成功后会顺便登录（后端直接返回 token）。
 * @param {object} payload { username, password, nickname }
 * @returns {Promise<{token, user}>}
 */
function register(payload) {
  return request('/auth/register', { method: 'POST', body: payload });
}

/**
 * 登录
 * @param {object} payload { username, password }
 * @returns {Promise<{token, user}>}
 */
function login(payload) {
  return request('/auth/login', { method: 'POST', body: payload });
}

/**
 * 退出登录。后端会把 token 作废。
 */
function logout() {
  return request('/auth/logout', { method: 'POST' });
}

/**
 * 获取当前登录用户。
 *
 * 没登录时后端返回 401，这里会抛出错误。
 * 调用处用 try/catch 包一下即可 —— 抛错是正常情况，不是 bug。
 */
function getMe() {
  return request('/auth/me');
}

/* ============================================================
   工具函数
   ============================================================ */

/**
 * 把对象变成 URL 查询字符串。
 * 例：{ keyword: '耳机', page: 2 }  ->  '?keyword=%E8%80%B3%E6%9C%BA&page=2'
 *
 * 注意 encodeURIComponent：中文和特殊符号必须转码，
 * 否则浏览器可能发不出正确的请求。
 */
function buildQueryString(params) {
  if (!params) return '';

  var parts = [];
  // Object.keys 拿到对象所有的属性名
  var keys = Object.keys(params);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = params[key];

    // 跳过空值：不然会变成 ?keyword=undefined
    if (value === undefined || value === null || value === '') continue;

    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  }

  return parts.length > 0 ? '?' + parts.join('&') : '';
}

// 挂到 window 上，其它 js 文件就能用了
window.api = {
  request: request,
  // 商品
  getProducts: getProducts,
  getProduct: getProduct,
  getCategories: getCategories,
  // 订单
  createOrder: createOrder,
  getOrder: getOrder,
  getOrders: getOrders,
  // 用户
  register: register,
  login: login,
  logout: logout,
  getMe: getMe,
  // 登录凭证（auth.js 会用到）
  getToken: getStoredToken,
  setToken: setStoredToken
};
