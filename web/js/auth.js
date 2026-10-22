/* ============================================================
   auth.js —— 登录状态管理 + 登录/注册界面
   ------------------------------------------------------------
   这个文件负责三件事：
   1. 记住"当前是谁登录着"（登录状态）
   2. 渲染顶部的登录按钮 / 用户菜单
   3. 处理登录、注册、退出这三个操作

   【登录状态到底存在哪？】
   存两个地方，各管一段：

   localStorage 里的 token（由 api.js 管）
     → 这是"通行证"，刷新页面后还在，后端认它

   内存里的 currentUser 对象（这个文件管）
     → 这是"用户的昵称头像等信息"，刷新后要重新问后端要
     → 为什么不把用户信息也存 localStorage？
        因为存的可能是旧数据（比如改了昵称），
        每次刷新问一次后端，拿到的永远是最新的

   所以页面加载时的流程是：
     有 token → 问后端"我是谁" → 拿到用户信息 → 显示已登录
     没 token → 直接显示未登录
   ============================================================ */

/* ============================================================
   一、状态
   ============================================================ */

var authState = {
  user: null,        // 当前登录用户，没登录时是 null
  isReady: false     // 是否已经完成"初始化检查"
};

// 关心登录状态变化的回调（和购物车的 subscribe 一个思路）
var authListeners = [];

/**
 * 当前是否已登录
 */
function isLoggedIn() {
  return authState.user !== null;
}

/**
 * 拿当前用户（没登录返回 null）
 */
function getCurrentUser() {
  return authState.user;
}

/**
 * 注册一个监听函数，登录状态变化时会被调用
 */
function subscribeAuth(listener) {
  if (typeof listener === 'function') {
    authListeners.push(listener);
  }
}

/**
 * 通知所有监听者
 */
function notifyAuth() {
  for (var i = 0; i < authListeners.length; i++) {
    try {
      authListeners[i](authState.user);
    } catch (err) {
      console.error('登录状态监听器出错：', err);
    }
  }
}

/**
 * 更新当前用户并通知界面
 */
function setCurrentUser(user) {
  authState.user = user || null;
  notifyAuth();
}

/* ============================================================
   三、登录 / 注册 / 退出
   ============================================================ */

/**
 * 登录
 * @param {string} username
 * @param {string} password
 * @returns {{ok:boolean, message:string}}
 */
async function doLogin(username, password) {
  try {
    var result = await window.api.login({
      username: username,
      password: password
    });

    // 先存 token，再设用户 —— 顺序不能反。
    // 因为设用户之后会触发界面重新渲染，
    // 有些界面可能会顺手发别的请求，那些请求需要 token 已经就位。
    window.api.setToken(result.token);
    setCurrentUser(result.user);

    return { ok: true, message: '登录成功' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * 注册（成功后会自动登录）
 */
async function doRegister(username, password, nickname) {
  try {
    var result = await window.api.register({
      username: username,
      password: password,
      nickname: nickname
    });

    window.api.setToken(result.token);
    setCurrentUser(result.user);

    return { ok: true, message: '注册成功' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * 退出登录
 */
async function doLogout() {
  try {
    // 通知后端把这个 token 作废。
    // 不通知也能"退出"（前端删掉 token 就行），
    // 但那样 token 在服务端还有效，万一被人捡到还能用。
    await window.api.logout();
  } catch (err) {
    // 退出失败也不阻断 —— 用户的意图是"我要退出"，
    // 不能因为网络问题把人留在登录状态里
    console.warn('通知后端退出失败：', err.message);
  }

  window.api.setToken('');
  setCurrentUser(null);
  return { ok: true, message: '已退出登录' };
}

/* ============================================================
   四、顶部导航栏的登录区
   ------------------------------------------------------------
   这块内容会出现在三个页面里，所以写成一个函数，
   每个页面调用一次就行，不用复制三份 HTML。
   ============================================================ */

/**
 * 渲染导航栏右侧的登录按钮 / 用户菜单
 */
function renderAuthArea() {
  var el = utils.$('#authArea');
  if (!el) return;

  var user = authState.user;

  /* ---- 没登录：显示"登录"按钮 ---- */
  if (!user) {
    el.innerHTML =
      '<button class="icon-btn auth-trigger" id="loginTrigger" type="button" title="登录 / 注册">' +
        '<span class="icon">' + window.icons.icon('user', 19) + '</span>' +
        '<span class="icon-label">登录</span>' +
      '</button>';
    return;
  }

  /* ---- 已登录：显示头像 + 昵称，点开是菜单 ---- */
  // 头像用昵称的第一个字，比放一张默认头像图片简单，也更有辨识度
  var initial = (user.nickname || user.username || '?').charAt(0).toUpperCase();

  el.innerHTML =
    '<div class="user-menu">' +
      '<button class="icon-btn user-trigger" id="userTrigger" type="button" ' +
              'title="' + utils.escapeHtml(user.nickname) + '">' +
        '<span class="user-avatar">' + utils.escapeHtml(initial) + '</span>' +
        '<span class="icon-label">' + utils.escapeHtml(user.nickname) + '</span>' +
      '</button>' +

      '<div class="user-dropdown" id="userDropdown" hidden>' +
        '<div class="user-dropdown-head">' +
          '<div class="user-avatar user-avatar-lg">' + utils.escapeHtml(initial) + '</div>' +
          '<div class="user-dropdown-info">' +
            '<div class="user-dropdown-name">' + utils.escapeHtml(user.nickname) + '</div>' +
            '<div class="user-dropdown-id">@' + utils.escapeHtml(user.username) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="user-dropdown-body">' +
          '<div class="user-meta-row">' +
            '<span class="user-meta-label">注册时间</span>' +
            '<span class="user-meta-value">' +
              utils.formatDateTime(user.createdAt).slice(0, 10) +
            '</span>' +
          '</div>' +
        '</div>' +

        '<div class="user-dropdown-foot">' +
          '<a class="user-menu-item" href="./orders.html">' +
            window.icons.icon('receipt', 15) + ' 我的订单' +
          '</a>' +
          '<button class="user-menu-item is-danger" id="logoutBtn" type="button">' +
            window.icons.icon('logOut', 15) + ' 退出登录' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

/* ============================================================
   五、登录 / 注册弹窗
   ============================================================ */

// 当前弹窗显示的是"登录"还是"注册"
var authMode = 'login';

/**
 * 打开弹窗
 * @param {string} mode 'login' 或 'register'
 */
function openAuthModal(mode) {
  authMode = mode === 'register' ? 'register' : 'login';

  var mask = utils.$('#authMask');
  if (!mask) return;

  // 切换弹窗标题、按钮文字、以及"去注册/去登录"的提示
  updateAuthModalText();

  // 清空表单和错误提示
  clearAuthForm();

  mask.hidden = false;
  document.body.style.overflow = 'hidden';

  // 自动聚焦第一个输入框
  var firstInput = utils.$('#authUsername');
  if (firstInput) {
    setTimeout(function () { firstInput.focus(); }, 100);
  }
}

/**
 * 关闭弹窗
 */
function closeAuthModal() {
  var mask = utils.$('#authMask');
  if (!mask) return;

  mask.hidden = true;
  document.body.style.overflow = '';
  clearAuthForm();
}

/**
 * 根据当前模式更新弹窗上的文字
 */
function updateAuthModalText() {
  var isRegister = authMode === 'register';

  var titleEl = utils.$('#authTitle');
  if (titleEl) titleEl.textContent = isRegister ? '注册新账号' : '登录';

  var descEl = utils.$('#authDesc');
  if (descEl) {
    descEl.textContent = isRegister
      ? '注册后可以看到自己的订单记录'
      : '登录后可以查看「我的订单」';
  }

  // 昵称只在注册时显示
  var nicknameRow = utils.$('#authNicknameRow');
  if (nicknameRow) nicknameRow.hidden = !isRegister;

  var submitBtn = utils.$('#authSubmit');
  if (submitBtn) submitBtn.textContent = isRegister ? '注册并登录' : '登录';

  // 底部"还没有账号？去注册" / "已有账号？去登录"
  var switchText = utils.$('#authSwitchText');
  if (switchText) {
    switchText.textContent = isRegister ? '已经有账号了？' : '还没有账号？';
  }

  var switchBtn = utils.$('#authSwitchBtn');
  if (switchBtn) {
    switchBtn.textContent = isRegister ? '去登录' : '免费注册';
  }
}

/**
 * 清空表单和错误信息
 */
function clearAuthForm() {
  var ids = ['authUsername', 'authPassword', 'authNickname'];
  for (var i = 0; i < ids.length; i++) {
    var el = utils.$('#' + ids[i]);
    if (el) {
      el.value = '';
      el.classList.remove('is-invalid');
    }
  }

  var err = utils.$('#authError');
  if (err) err.textContent = '';

  var btn = utils.$('#authSubmit');
  if (btn) {
    btn.disabled = false;
    btn.textContent = authMode === 'register' ? '注册并登录' : '登录';
  }
}

/**
 * 显示错误
 */
function showAuthError(message) {
  var err = utils.$('#authError');
  if (err) err.textContent = message;
}

/**
 * 校验表单（前端先挡一道，后端还会再验一遍）
 */
function validateAuthForm() {
  var username = (utils.$('#authUsername').value || '').trim();
  var password = utils.$('#authPassword').value || '';
  var nickname = (utils.$('#authNickname').value || '').trim();

  if (!username) {
    showAuthError('请填写用户名');
    return null;
  }

  // 登录时不校验用户名格式 —— 老账号可能不符合新规则，
  // 格式校验只在注册时做
  if (authMode === 'register') {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      showAuthError('用户名需要 3~20 位，只能包含字母、数字、下划线');
      return null;
    }
    if (password.length < 6) {
      showAuthError('密码至少 6 位');
      return null;
    }
  }

  if (!password) {
    showAuthError('请填写密码');
    return null;
  }

  return { username: username, password: password, nickname: nickname };
}

/**
 * 提交表单（登录或注册）
 */
async function submitAuthForm() {
  var form = validateAuthForm();
  if (!form) return;

  var submitBtn = utils.$('#authSubmit');
  var originalText = submitBtn ? submitBtn.textContent : '';

  // 防止用户狂点导致重复提交
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = authMode === 'register' ? '注册中…' : '登录中…';
  }
  showAuthError('');

  try {
    var result = authMode === 'register'
      ? await doRegister(form.username, form.password, form.nickname)
      : await doLogin(form.username, form.password);

    if (!result.ok) {
      showAuthError(result.message);
      return;
    }

    closeAuthModal();
    utils.toast(result.message, 'success');

    // 登录/注册成功后，如果当前在订单页，刷新一下订单列表。
    // 注意：如果用户是在"加购物车/结算"时被拦下来登录的，
    // 这里不会自动重试刚才的操作 —— 需要用户再点一次。
    // 这样做是有意的：自动重试容易让人搞不清到底做了什么。
    if (typeof window.refreshOrdersAfterAuth === 'function') {
      window.refreshOrdersAfterAuth();
    }

  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

/* ============================================================
   五、事件绑定
   ============================================================ */

/**
 * 绑定登录相关的所有事件。
 * 每个页面初始化时调用一次。
 */
function initAuthEvents() {
  /* ---- 顶部区域的点击（用事件委托，因为内容是动态渲染的）---- */
  var authArea = utils.$('#authArea');
  if (authArea) {
    authArea.addEventListener('click', async function (event) {
      // 点"登录"
      if (event.target.closest('#loginTrigger')) {
        openAuthModal('login');
        return;
      }

      // 点头像 → 展开/收起菜单
      if (event.target.closest('#userTrigger')) {
        var dropdown = utils.$('#userDropdown');
        if (dropdown) dropdown.hidden = !dropdown.hidden;
        return;
      }

      // 点退出
      if (event.target.closest('#logoutBtn')) {
        var result = await doLogout();
        utils.toast(result.message, 'success');

        if (typeof window.refreshOrdersAfterAuth === 'function') {
          window.refreshOrdersAfterAuth();
        }
        return;
      }
    });
  }

  /* ---- 点页面其它地方时收起用户菜单 ---- */
  document.addEventListener('click', function (event) {
    var dropdown = utils.$('#userDropdown');
    if (!dropdown || dropdown.hidden) return;

    // 点在菜单内部或头像上不收起
    if (event.target.closest('#userDropdown') || event.target.closest('#userTrigger')) {
      return;
    }
    dropdown.hidden = true;
  });

  /* ---- 弹窗关闭 ---- */
  var authClose = utils.$('#authClose');
  if (authClose) authClose.addEventListener('click', closeAuthModal);

  var authMask = utils.$('#authMask');
  if (authMask) {
    authMask.addEventListener('click', function (event) {
      // 只有点到遮罩本身才关，点弹窗内部不关
      if (event.target === authMask) closeAuthModal();
    });
  }

  /* ---- 提交 ---- */
  var authForm = utils.$('#authForm');
  if (authForm) {
    authForm.addEventListener('submit', function (event) {
      event.preventDefault();
      submitAuthForm();
    });
  }

  var authSubmit = utils.$('#authSubmit');
  if (authSubmit) {
    authSubmit.addEventListener('click', function (event) {
      event.preventDefault();
      submitAuthForm();
    });
  }

  /* ---- 登录/注册切换 ---- */
  var authSwitchBtn = utils.$('#authSwitchBtn');
  if (authSwitchBtn) {
    authSwitchBtn.addEventListener('click', function () {
      openAuthModal(authMode === 'login' ? 'register' : 'login');
    });
  }

  /* ---- 输入时清掉错误提示，体验更顺 ---- */
  var inputs = ['authUsername', 'authPassword', 'authNickname'];
  for (var i = 0; i < inputs.length; i++) {
    var input = utils.$('#' + inputs[i]);
    if (input) {
      input.addEventListener('input', function () {
        showAuthError('');
      });
    }
  }

  /* ---- 登录状态变化 → 重新渲染顶部区域 ---- */
  subscribeAuth(renderAuthArea);
}

/* ============================================================
   六、页面初始化
   ============================================================ */

/**
 * 每个页面都要调用一次。
 * 会先确认登录状态，再渲染顶部区域。
 */
async function initAuth() {
  await doInitAuth();
  renderAuthArea();
  initAuthEvents();

  // 初始化完成后再通知一次，让依赖登录状态的页面逻辑跑起来
  notifyAuth();
}

/**
 * 真正干活的初始化（和上面分开，是为了避免函数重名混淆）
 */
async function doInitAuth() {
  var token = window.api.getToken();

  if (!token) {
    authState.isReady = true;
    authState.user = null;
    return;
  }

  try {
    var user = await window.api.getMe();
    authState.user = user;
  } catch (err) {
    // 401 说明 token 失效了，清掉；网络错误则保留 token
    if (err.status === 401) {
      window.api.setToken('');
    }
    authState.user = null;
  } finally {
    authState.isReady = true;
  }
}

/* ============================================================
   六、需要登录才能做的操作
   ------------------------------------------------------------
   加购物车、结算、下单这些操作都要先登录。
   每个地方都写一遍 if 判断会很啰嗦，而且提示文字容易不一致，
   所以统一放在这个函数里。

   用法：
     if (!window.auth.requireLogin('加入购物车')) return;
     ...继续原来的逻辑
   ============================================================ */

/**
 * 检查是否已登录。没登录就弹登录框并提示。
 *
 * @param {string} actionName 操作名称，用来拼提示语，如"加入购物车"
 * @returns {boolean} true 表示已登录，可以继续；false 表示已弹框，调用处应 return
 */
function requireLogin(actionName) {
  if (isLoggedIn()) {
    return true;
  }

  var name = actionName || '进行这个操作';
  utils.toast('请先登录后再' + name, 'info');
  openAuthModal('login');
  return false;
}

/* ============================================================
   七、导出
   ============================================================ */

window.auth = {
  init: initAuth,
  isLoggedIn: isLoggedIn,
  getUser: getCurrentUser,
  subscribe: subscribeAuth,
  open: openAuthModal,
  close: closeAuthModal,
  requireLogin: requireLogin,
  logout: doLogout,
  state: authState
};
