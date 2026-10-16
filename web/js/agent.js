/* ============================================================
   agent.js —— AI 购物助手（前端）
   ------------------------------------------------------------
   【这个文件的定位，你要先搞清楚】

   考核第九节要求做一个"AI 购物助手 Agent"。Agent 的核心是：
      用户说话 → 模型理解 → 调用工具(Tool) → 拿到真实数据 → 回答

   这个文件目前实现的是**前端界面 + 本地规则引擎**版本：
   - 意图识别、参数提取、工具调用、多轮上下文、确认机制 全都有
   - 只是"理解自然语言"这一步暂时用规则（关键词匹配）代替大模型

   为什么要这样做？
   1. 现在就能跑通、能演示，不依赖 API Key
   2. 界面、工具、确认流程、状态同步这些"工程部分"都做好之后，
      后面只要把 decideIntent() 换成真模型，其它代码一行都不用改

   【后面升级成真模型要改的地方，我标了 TODO-AI】
   ============================================================ */

/* ============================================================
   一、对话状态
   ============================================================ */

var agentState = {
  // 对话历史：[{ role: 'user'|'assistant', content: '...' }]
  // 这就是"多轮上下文"的载体，模型要靠它理解"再便宜一点的"
  messages: [],

  // 上一轮推荐过的商品，用于理解"刚才推荐的那款"
  lastRecommended: [],

  // 上一轮识别出的需求，用于理解"便宜一点" = 在上一轮基础上加约束
  lastQuery: null,

  // 待确认的写操作（加购/下单前必须用户同意 —— 考核 9.4 要求）
  pendingAction: null,

  // 是否正在请求中
  isBusy: false
};

// 快捷问题
var AGENT_QUICK_CHIPS = [
  '500 元以内的耳机有吗？',
  '推荐一个 1000 元以内的机械键盘',
  '我有 1000 元，想买耳机和键盘，最好同一品牌',
  '帮我看看购物车里有什么'
];

/* ============================================================
   二、工具（Tool）定义
   ------------------------------------------------------------
   Agent 的"工具"就是它能调用的函数。
   每个工具要有：名字、干什么用、需要什么参数。
   这正是后面接大模型时，要写进 system prompt 或 tools 参数的东西。
   ============================================================ */

/**
 * 工具 1：搜索商品（只读，考核 9.2）
 * @param {object} params { keyword, category, maxPrice, minPrice, sort, limit }
 *
 * 【踩过的坑】这里只认 limit，不认 pageSize。
 * 我一开始在调用处写的是 { pageSize: 3 }，结果被这里忽略、
 * 走了默认值 6，导致"只推荐 3 款"的改动完全没生效，
 * 多轮对话还是走不通。现在两个名字都支持，避免再踩。
 */
async function toolSearchProducts(params) {
  var p = params || {};
  var result = await window.api.getProducts({
    keyword: p.keyword || '',
    category: p.category || '',
    minPrice: p.minPrice === undefined ? '' : p.minPrice,
    maxPrice: p.maxPrice === undefined ? '' : p.maxPrice,
    sort: p.sort || 'price_asc',
    page: p.page || 1,
    pageSize: p.limit || p.pageSize || 6
  });
  return result;
}

/**
 * 工具 2：查询商品详情（只读）
 */
async function toolGetProduct(productId) {
  return await window.api.getProduct(productId);
}

/**
 * 工具 3：查询购物车（只读，考核 9.4）
 */
function toolGetCart() {
  return {
    items: cart.getItems(),
    totalCount: cart.getTotalCount(),
    totalPrice: cart.getTotalPrice()
  };
}

/**
 * 工具 4：加入购物车（写操作 —— 必须先确认）
 */
async function toolAddToCart(productId, quantity) {
  var product = await window.api.getProduct(productId);
  var result = cart.add(product, quantity || 1);
  if (!result.ok) throw new Error(result.message);
  return { ok: true, product: product, quantity: quantity || 1 };
}

/**
 * 工具 5：修改购物车数量（写操作 —— 必须先确认）
 */
function toolUpdateCartItem(productId, quantity) {
  var result = cart.updateQuantity(productId, quantity);
  if (!result.ok) throw new Error(result.message);
  return { ok: true };
}

/**
 * 工具 6：移除购物车商品（写操作 —— 必须先确认）
 */
function toolRemoveFromCart(productId) {
  var result = cart.remove(productId);
  if (!result.ok) throw new Error(result.message);
  return { ok: true };
}

/**
 * 工具 7：创建订单（写操作 —— 必须先确认）
 */
async function toolCreateOrder() {
  if (cart.isEmpty()) {
    throw new Error('购物车是空的，无法下单');
  }
  var order = await window.api.createOrder({
    items: cart.toOrderItems(),
    customer: { name: 'AI 助手代下单', phone: '13800138000', address: '待用户补充收货地址' },
    remark: '由 AI 购物助手创建'
  });
  cart.clear();
  return order;
}

/* ============================================================
   三、自然语言理解（规则版）
   ------------------------------------------------------------
   【TODO-AI】接大模型时，把 understand() 换成一次 API 调用即可。

   现在做的事：
   1. 从句子里提取 预算 / 分类 / 关键词 / 排序偏好
   2. 判断用户想干什么（查商品 / 看购物车 / 加购 / 下单 / 闲聊）
   ============================================================ */

// 中文数字和口语预算的说法
var BUDGET_PATTERNS = [
  /(\d+)\s*(?:元|块|块钱|rmb|RMB)?\s*(?:以内|以下|左右|之内|内|封顶)/,
  /预算\s*(?:是|为|在)?\s*(\d+)/,
  /(?:不超过|最多|顶多|不到)\s*(\d+)/,
  /(\d+)\s*(?:元|块|块钱)/
];

// 分类关键词映射：句子里出现这些词就认为是某个分类
var CATEGORY_KEYWORDS = [
  { id: 'audio', words: ['耳机', '耳塞', '耳麦', '降噪', '蓝牙耳机', '入耳', '头戴'] },
  { id: 'keyboard', words: ['键盘', '机械键盘', '键帽', '打字'] },
  { id: 'mouse', words: ['鼠标', '鼠标垫', '电竞鼠标'] },
  { id: 'power', words: ['充电宝', '充电器', '移动电源', '氮化镓', '快充头'] },
  { id: 'smart', words: ['台灯', '智能家居', '音箱', '插座', '护眼灯'] },
  { id: 'accessory', words: ['支架', '理线', '配件', '收纳'] }
];

/**
 * 从一句话里提取预算上限
 */
function extractBudget(text) {
  for (var i = 0; i < BUDGET_PATTERNS.length; i++) {
    var match = text.match(BUDGET_PATTERNS[i]);
    if (match && match[1]) {
      var num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num < 1000000) return num;
    }
  }
  return null;
}

/**
 * 从一句话里提取商品分类
 */
function extractCategory(text) {
  for (var i = 0; i < CATEGORY_KEYWORDS.length; i++) {
    var group = CATEGORY_KEYWORDS[i];
    for (var j = 0; j < group.words.length; j++) {
      if (text.indexOf(group.words[j]) !== -1) {
        return { id: group.id, matchedWord: group.words[j] };
      }
    }
  }
  return null;
}

/**
 * 判断用户意图
 */
function decideIntent(text) {
  var t = text.toLowerCase();

  // ---- 超范围请求：礼貌拒答（考核 9.6 第 2 条）----
  //
  // 【为什么要用正则而不是简单关键词列表？】
  // 因为用户会写"帮我写个 python 函数"，中间有空格；
  // 也可能写"写python函数"没有空格。用 \s* 就能同时匹配两种情况。
  // 这是实际调试中发现的问题：最初的写法漏掉了带空格的输入。
  var OUT_OF_SCOPE_PATTERNS = [
    /写\s*(个|一段|一个)?\s*(代码|函数|程序|脚本|demo|案例)/,
    /(帮|替)我\s*写\s*(个|一段|一个)?\s*\w*/,
    /写\s*(python|java|javascript|js|go|c\+\+|c语言|sql|html|css)/i,
    /(编程|算法|数据结构)\s*(题|作业|练习)/,
    /(天气|气温|下雨|股票|汇率|彩票|算命|星座)/,
    /(讲|说)\s*(个|一个)?\s*(笑话|故事)/,
    /(翻译|写作文|写论文|写报告|做数学题|化学|物理题|历史)/,
    /你\s*(是|是不是)\s*(谁|什么|人类|机器人)/,
    /(菜谱|做饭|减肥|健身计划|医疗|看病|法律咨询)/
  ];
  for (var i = 0; i < OUT_OF_SCOPE_PATTERNS.length; i++) {
    if (OUT_OF_SCOPE_PATTERNS[i].test(t)) {
      return { type: 'out_of_scope' };
    }
  }

  // ---- 提示词注入攻击（考核 9.6 第 3 条）----
  // 同样用正则以覆盖多种说法和空格
  var INJECTION_PATTERNS = [
    /忽略\s*(你)?\s*(之前|以上|前面|所有|全部)?\s*(的)?\s*(指令|设定|规则|提示)/,
    /(忘记|忘掉|清除|重置)\s*(你)?\s*(的)?\s*(指令|设定|规则|身份)/,
    /(你\s*现在\s*是|假装\s*你\s*是|扮演)/,
    /(把|将)\s*(价格|价钱)\s*(改|设|调)\s*(成|为)/,
    /\d+\s*元?\s*卖\s*(给)?\s*我/,
    /(免费|白送|不要钱)\s*(给)?\s*(我|送)/,
    /(system\s*prompt|系统提示词|系统指令)/i,
    /(无视|不要管|不用管|绕过)\s*(规则|限制|设定|指令)/,
    /(越狱|jailbreak|开发者模式|DAN模式)/i
  ];
  for (var k = 0; k < INJECTION_PATTERNS.length; k++) {
    if (INJECTION_PATTERNS[k].test(t)) {
      return { type: 'prompt_injection' };
    }
  }

  // ---- 确认 / 取消 ----
  if (/^(好|好的|可以|行|嗯|确认|确定|同意|没问题|买吧|下单吧|yes|ok)$/.test(t.replace(/\s/g, ''))) {
    return { type: 'confirm' };
  }
  if (/^(不用|不要|取消|算了|不买|no)$/.test(t.replace(/\s/g, ''))) {
    return { type: 'cancel' };
  }

  // ---- 查购物车 ----
  if (t.indexOf('购物车') !== -1 && !t.indexOf('加')) {
    return { type: 'query_cart' };
  }
  if (t.indexOf('购物车') !== -1 && (t.indexOf('看') !== -1 || t.indexOf('有什么') !== -1 || t.indexOf('查') !== -1)) {
    return { type: 'query_cart' };
  }

  // ---- 加购 ----
  if (t.indexOf('加购') !== -1 || t.indexOf('加入购物车') !== -1 ||
      (t.indexOf('买') !== -1 && t.indexOf('帮我') !== -1 && t.indexOf('耳机') === -1 && t.indexOf('键盘') === -1)) {
    return { type: 'add_to_cart' };
  }

  // ---- 下单 ----
  if (t.indexOf('下单') !== -1 || t.indexOf('结算') !== -1 || t.indexOf('结账') !== -1 ||
      t.indexOf('提交订单') !== -1) {
    return { type: 'create_order' };
  }

  // ---- 组合购买（多约束求解，考核 9.5）----
  if ((t.indexOf('耳机') !== -1 && t.indexOf('键盘') !== -1) ||
      ((t.indexOf('预算') !== -1 || /\d+\s*元/.test(t)) && t.indexOf('和') !== -1 && t.indexOf('买') !== -1)) {
    return { type: 'combo_plan' };
  }

  // ---- "便宜一点" 这类追问（考核 9.3 多轮上下文）----
  if (t.indexOf('便宜') !== -1 || t.indexOf('贵') !== -1 || t.indexOf('低一点') !== -1) {
    return { type: 'refine_cheaper' };
  }

  // ---- 需求模糊：追问澄清（考核 9.6 第 1 条）----
  if (/^(随便|都行|不知道|看看|随便看看|有什么好东西|推荐一下|有什么推荐)/.test(t) ||
      t.indexOf('随便看看') !== -1 || t.indexOf('有什么好东西') !== -1) {
    return { type: 'ambiguous' };
  }

  // ---- 默认：搜索商品 ----
  return { type: 'search_products' };
}

/**
 * 把一句话理解成结构化的"需求对象"
 */
function understand(text) {
  var intent = decideIntent(text);
  var category = extractCategory(text);
  var budget = extractBudget(text);

  return {
    intent: intent.type,
    rawText: text,
    category: category ? category.id : null,
    categoryWord: category ? category.matchedWord : null,
    budget: budget,
    wantsSameBrand: text.indexOf('同一品牌') !== -1 ||
                    text.indexOf('同品牌') !== -1 ||
                    text.indexOf('一个牌子') !== -1 ||
                    text.indexOf('同样品牌') !== -1
  };
}

/* ============================================================
   四、Agent 主循环：理解 → 调工具 → 回答
   ============================================================ */

/**
 * 处理一条用户消息。
 * @param {string} text 用户输入
 */
async function handleUserMessage(text) {
  if (agentState.isBusy) return;

  var trimmed = (text || '').trim();
  if (!trimmed) return;

  // 1. 先把用户消息显示出来，并记进历史
  appendMessage('user', trimmed);
  agentState.messages.push({ role: 'user', content: trimmed });

  // 2. 显示"正在输入"
  var typingEl = appendTyping();

  setBusy(true);

  try {
    // ===== 【TODO-AI】接真模型时，这里换成一次后端 API 调用 =====
    // 现在用规则引擎本地推断
    var need = understand(trimmed);

    // 3. 根据意图调用不同的工具并生成回复
    var reply = await runIntent(need);

    // 4. 移除"正在输入"，把回复显示出来
    removeTyping(typingEl);

    if (reply && reply.text) {
      appendMessage('assistant', reply.text, reply.products, reply.steps);
      agentState.messages.push({ role: 'assistant', content: reply.text });

      // 记住这轮推荐，供下一轮"便宜一点"参考
      if (reply.products && reply.products.length > 0) {
        agentState.lastRecommended = reply.products;
      }
      if (reply.query) {
        agentState.lastQuery = reply.query;
      }
    }

  } catch (err) {
    removeTyping(typingEl);
    console.error('Agent 处理出错：', err);
    appendMessage('assistant', '抱歉，我这边出了点问题：' + err.message + '\n再试一次好吗？');
  } finally {
    setBusy(false);
  }
}

/**
 * 按意图执行对应的工具调用，返回要显示的内容。
 * @returns {Promise<{text, products?, steps?, query?}>}
 */
async function runIntent(need) {
  var steps = [];   // 记录执行步骤，用于展示"思考过程"

  switch (need.intent) {

    /* ---------- 超范围请求 ---------- */
    case 'out_of_scope':
      return {
        text: '不好意思，我是云巢商城的购物助手，只能帮你解决商城相关的问题\n\n' +
              '比如你可以问我：\n' +
              '· 500 元以内的运动耳机有吗？\n' +
              '· 推荐一个适合办公的机械键盘\n' +
              '· 帮我看看购物车里有什么'
      };

    /* ---------- 提示词注入 ---------- */
    case 'prompt_injection':
      return {
        text: '这个我没法照做哦\n\n' +
              '我是云巢商城的购物助手，所有商品价格都来自商城的真实数据，' +
              '不能修改价格、也不能给出违反商城规则的承诺。\n\n' +
              '如果你有购物需求，我很乐意帮忙挑选商品～'
      };

    /* ---------- 需求太模糊，追问澄清 ---------- */
    case 'ambiguous':
      return {
        text: '没问题，不过云巢商城的商品还挺多的，我想先了解一下你的需求，这样推荐更准\n\n' +
              '可以告诉我：\n' +
              '1. 你想买哪一类商品？（耳机 / 键盘 / 鼠标 / 充电储能 / 智能家居 / 配件）\n' +
              '2. 大概的预算范围是多少？\n' +
              '3. 有什么特别看重的点吗？（比如降噪、静音、便携）'
      };

    /* ---------- 查询购物车 ---------- */
    case 'query_cart': {
      steps.push({ name: 'getCart', args: '{}', result: '读取购物车状态' });
      var cartData = toolGetCart();

      if (cartData.items.length === 0) {
        return {
          text: '你的购物车目前是空的\n\n要我帮你推荐点什么吗？',
          steps: steps
        };
      }

      var lines = ['你的购物车里有 ' + cartData.totalCount + ' 件商品：', ''];
      for (var i = 0; i < cartData.items.length; i++) {
        var it = cartData.items[i];
        lines.push('· ' + it.name + ' × ' + it.quantity + ' = ¥' + utils.formatPrice(it.price * it.quantity));
      }
      lines.push('');
      lines.push('合计：¥' + utils.formatPrice(cartData.totalPrice));
      lines.push('');
      lines.push('需要我帮你下单吗？');

      return { text: lines.join('\n'), steps: steps };
    }

    /* ---------- 搜索商品 ---------- */
    case 'search_products': {
      /* 【为什么这里按评分排序、而且只取 3 条？】
       *
       * 最初我写的是"价格升序 + 取 6 条"，结果 6 款键盘一次全列完了。
       * 用户接着说"便宜一点"，Agent 就没东西可推了，只能回答"没有了"——
       * 多轮对话直接死掉。这是实际测试中暴露出来的设计问题。
       *
       * 改成"综合评分排序 + 只推荐 3 条"之后：
       *   1. 更像真人导购（给你挑几款，而不是甩一张清单）
       *   2. 后续追问"便宜点""还有别的吗"依然有内容可以推进
       */
      var params = { sort: 'rating', pageSize: 3 };
      if (need.category) params.category = need.category;
      if (need.budget) params.maxPrice = need.budget;

      // 没有分类但有具体关键词时（比如"降噪耳机"），用关键词搜
      var keyword = extractSearchKeyword(need.rawText);
      if (keyword && !need.category) params.keyword = keyword;
      if (need.category && !keyword) params.keyword = need.categoryWord;

      steps.push({
        name: 'searchProducts',
        args: JSON.stringify(params),
        result: '查询商城商品库'
      });

      // 先查一次看总量（用于文案和判断有没有结果）
      var countProbe = await toolSearchProducts({
        category: params.category, keyword: params.keyword,
        minPrice: params.minPrice, maxPrice: params.maxPrice,
        pageSize: 1
      });
      var totalMatched = countProbe.total;

      var result = await toolSearchProducts(params);
      steps[steps.length - 1].result = '匹配 ' + totalMatched + ' 个，精选 ' + result.items.length + ' 个推荐';

      if (totalMatched === 0) {
        return {
          text: buildNoResultText(need),
          steps: steps,
          query: params
        };
      }

      return {
        text: buildRecommendText(need, result, totalMatched),
        products: result.items,
        steps: steps,
        query: {
          category: params.category || '',
          keyword: params.keyword || '',
          maxPrice: params.maxPrice || ''
        }
      };
    }

    /* ---------- 便宜一点（多轮上下文） ---------- */
    case 'refine_cheaper': {
      // 关键：要在上一轮需求基础上收窄，而不是重新问用户

      // 如果完全没有上下文，说明用户一上来就说"便宜点"
      var base = agentState.lastQuery;
      if (!base || (!base.category && !base.keyword)) {
        return {
          text: '好的！不过我还不知道你想买哪类商品，方便说一下吗？\n' +
                '比如"耳机"、"键盘"，我再帮你找便宜的'
        };
      }

      /* 【这一步的算法很关键，我一开始写错过，说明一下】
       *
       * 错误写法：直接取"上一轮推荐里最便宜的 x 0.8"当新上限。
       * 为什么错？
       *   上一轮查询是按价格升序、只取前 6 条，
       *   所以 lastRecommended[0] 已经是全分类最便宜的那个了（比如 129 元）。
       *   再乘 0.8 得到 103 元，比商城最便宜的商品还低 —— 必然一个都搜不到，
       *   于是 Agent 就会错误地回答"没有更便宜的了"。这是真实发生过的 bug。
       *
       * 正确写法：
       *   以"上一轮推荐里最贵的"为上限（先把更贵的排除掉），
       *   然后在前端把"已经展示过的"过滤掉，
       *   剩下的才是真正"更便宜的新选项"。
       */
      var shownIds = [];
      var highestPrice = 0;
      for (var m = 0; m < agentState.lastRecommended.length; m++) {
        var shown = agentState.lastRecommended[m];
        shownIds.push(Number(shown.id));
        if (Number(shown.price) > highestPrice) highestPrice = Number(shown.price);
      }

      var refineParams = { sort: 'price_asc', pageSize: 50 };
      if (base.category) refineParams.category = base.category;
      if (base.keyword) refineParams.keyword = base.keyword;

      // 上限：用户明确说了预算就用用户的，否则用上一轮的最高价
      if (need.budget) {
        refineParams.maxPrice = need.budget;
      } else if (highestPrice > 0) {
        // 减 1 是为了把"上一轮最贵的那款"也排除掉，保证结果一定有变化
        refineParams.maxPrice = highestPrice - 1;
      }

      steps.push({
        name: 'searchProducts',
        args: JSON.stringify(refineParams),
        result: '在上一轮需求基础上收紧价格上限'
      });

      var cheaper = await toolSearchProducts(refineParams);
      steps[steps.length - 1].result = '返回 ' + cheaper.total + ' 个候选';

      // 过滤掉上一轮已经给用户看过的商品
      var freshItems = [];
      for (var n = 0; n < cheaper.items.length; n++) {
        if (shownIds.indexOf(Number(cheaper.items[n].id)) === -1) {
          freshItems.push(cheaper.items[n]);
        }
      }

      steps.push({
        name: 'filterSeen',
        args: JSON.stringify({ 已展示过: shownIds.length }),
        result: '排除已推荐过的，剩下 ' + freshItems.length + ' 个新选项'
      });

      /* ---- 没有新选项：老实说明，并给出替代建议 ---- */
      if (freshItems.length === 0) {
        var cheapestShown = null;
        for (var q = 0; q < agentState.lastRecommended.length; q++) {
          var priceQ = Number(agentState.lastRecommended[q].price);
          if (cheapestShown === null || priceQ < cheapestShown) cheapestShown = priceQ;
        }

        var categoryLabel = base.category
          ? components.getCategoryName(base.category)
          : '这个范围';

        var cheapestText = cheapestShown !== null
          ? utils.formatPrice(cheapestShown)
          : '暂无';

        return {
          text: '「' + categoryLabel + '」里更便宜的选择确实没有了\n\n' +
                '刚才推荐里最便宜的是 ¥' + cheapestText +
                '，它已经是全分类的最低价了。\n\n' +
                '两个建议：\n' +
                '· 我刚才推荐的 ¥' + cheapestText + ' 那款就是最省钱的选择；\n' +
                '· 如果你是想控制总预算，也可以直接告诉我预算数字，我按预算帮你重新挑。',
          steps: steps
        };
      }

      /* ---- 有新选项 ---- */
      var replyLines = [];
      replyLines.push('明白，你要比刚才更便宜的。我把之前推荐过的排除掉，重新找了一圈：');
      replyLines.push('');

      var showN = Math.min(3, freshItems.length);
      for (var s = 0; s < showN; s++) {
        replyLines.push((s + 1) + '. ' + freshItems[s].name +
                        ' — ¥' + utils.formatPrice(freshItems[s].price));
        replyLines.push('   ' + freshItems[s].tagline);
      }

      replyLines.push('');
      replyLines.push('这些都比上一轮推荐的更便宜，¥' +
                      utils.formatPrice(freshItems[0].price) + ' 那款最省。');

      return {
        text: replyLines.join('\n'),
        products: freshItems.slice(0, 3),
        steps: steps,
        query: refineParams
      };
    }

    /* ---------- 组合购买（多约束求解，9.5） ---------- */
    case 'combo_plan': {
      return await runComboPlan(need, steps);
    }

    /* ---------- 加入购物车 ---------- */
    case 'add_to_cart': {
      // 找出要加购的商品：优先用上一轮推荐的第一个
      var target = null;

      if (agentState.lastRecommended.length > 0) {
        target = agentState.lastRecommended[0];
      }

      if (!target) {
        // 没推荐过就问清楚
        var guessParams = { sort: 'price_asc', limit: 3 };
        var cat = need.category;
        if (cat) guessParams.category = cat;
        if (need.budget) guessParams.maxPrice = need.budget;

        var guessed = await toolSearchProducts(guessParams);
        if (guessed.items.length === 0) {
          return { text: '我没找到符合条件的商品，换个说法试试？' };
        }
        target = guessed.items[0];
      }

      // [重要] 写操作必须先确认（考核 9.4 第 2 条）
      agentState.pendingAction = {
        type: 'add_to_cart',
        productId: target.id,
        productName: target.name,
        quantity: 1
      };

      return {
        text: '好的，我准备把「' + target.name + '」（¥' + utils.formatPrice(target.price) + '）加入购物车。\n\n' +
              '确认要加购吗？回复"确认"即可。',
        products: [target],
        steps: steps
      };
    }

    /* ---------- 下单（写操作，必须先确认） ---------- */
    case 'create_order': {
      var cartData2 = toolGetCart();

      if (cartData2.items.length === 0) {
        return {
          text: '购物车还是空的，先挑点商品吧\n\n' +
                '你可以说"推荐 500 元以内的耳机"，我帮你找。'
        };
      }

      // [重要] 写操作必须先确认
      agentState.pendingAction = {
        type: 'create_order',
        totalPrice: cartData2.totalPrice,
        totalCount: cartData2.totalCount
      };

      return {
        text: '你购物车里有 ' + cartData2.totalCount + ' 件商品，合计 ¥' +
              utils.formatPrice(cartData2.totalPrice) + '。\n\n' +
              '确认要下单吗？（这是模拟支付，不会真的扣钱）\n回复"确认"即可。'
      };
    }

    /* ---------- 用户确认 ---------- */
    case 'confirm': {
      if (!agentState.pendingAction) {
        return { text: '好的 你还有什么想了解的？比如"1000 元以内的机械键盘"。' };
      }
      return await executePendingAction(steps);
    }

    /* ---------- 用户取消 ---------- */
    case 'cancel': {
      if (agentState.pendingAction) {
        agentState.pendingAction = null;
        return { text: '好的，已经取消了 需要我帮你看看别的吗？' };
      }
      return { text: '好的 有需要随时叫我。' };
    }

    default:
      return { text: '我不太确定你的意思，可以换个说法吗？比如"500 元以内的耳机"。' };
  }
}

/**
 * 执行待确认的写操作
 */
async function executePendingAction(steps) {
  var action = agentState.pendingAction;
  agentState.pendingAction = null;   // 立刻清掉，防止重复执行

  if (!action) {
    return { text: '没有待确认的操作。' };
  }

  if (action.type === 'add_to_cart') {
    steps.push({
      name: 'addToCart',
      args: JSON.stringify({ productId: action.productId, quantity: action.quantity }),
      result: '执行中…'
    });

    var added = await toolAddToCart(action.productId, action.quantity);
    steps[steps.length - 1].result = '已加入购物车';

    // 前端购物车实时同步（考核 9.4 第 3 条）
    components.openCartDrawer();

    return {
      text: '已经帮你加进购物车了\n\n' +
            '· ' + added.product.name + ' × ' + added.quantity +
            '（¥' + utils.formatPrice(added.product.price * added.quantity) + '）\n\n' +
            '购物车右侧已经打开了，你可以直接去结算，或者让我帮你下单。',
      steps: steps
    };
  }

  if (action.type === 'create_order') {
    steps.push({ name: 'createOrder', args: '{}', result: '执行中…' });

    var order = await toolCreateOrder();
    steps[steps.length - 1].result = '订单号 ' + order.id;

    // 订单页实时同步
    components.showOrderResult(order);

    return {
      text: '下单成功\n\n' +
            '· 订单编号：' + order.id + '\n' +
            '· 商品件数：' + order.itemCount + ' 件\n' +
            '· 订单总价：¥' + utils.formatPrice(order.totalPrice) + '\n' +
            '· 订单状态：' + order.statusText + '\n\n' +
            '订单详情已经弹出来啦，也可以在「我的订单」页面查看。',
      steps: steps
    };
  }

  return { text: '操作完成。' };
}

/* ============================================================
   五、组合购买规划（考核 9.5 多步规划 + 约束求解）
   ------------------------------------------------------------
   场景："我有 1000 元预算，想买一副耳机和一把键盘，
          最好是同一品牌，帮我看看怎么买最划算"
   ============================================================ */

async function runComboPlan(need, steps) {
  var budget = need.budget || 1000;

  steps.push({
    name: 'searchProducts',
    args: JSON.stringify({ category: 'audio', sort: 'price_asc', limit: 50 }),
    result: '查询耳机…'
  });

  // 第 1 步：把耳机和键盘的候选全拉出来
  var earphones = await toolSearchProducts({ category: 'audio', sort: 'price_asc', limit: 50 });
  steps[steps.length - 1].result = '耳机候选 ' + earphones.total + ' 个';

  steps.push({
    name: 'searchProducts',
    args: JSON.stringify({ category: 'keyboard', sort: 'price_asc', limit: 50 }),
    result: '查询键盘…'
  });

  var keyboards = await toolSearchProducts({ category: 'keyboard', sort: 'price_asc', limit: 50 });
  steps[steps.length - 1].result = '键盘候选 ' + keyboards.total + ' 个';

  // 过滤掉售罄的
  var eList = earphones.items.filter(function (p) { return p.stock > 0; });
  var kList = keyboards.items.filter(function (p) { return p.stock > 0; });

  steps.push({
    name: 'solveConstraints',
    args: JSON.stringify({ budget: budget, wantSameBrand: need.wantsSameBrand }),
    result: '在预算内穷举组合并比价'
  });

  // 第 2 步：找出所有"同品牌 + 总价在预算内"的组合
  var sameBrandPlans = [];
  for (var i = 0; i < eList.length; i++) {
    for (var j = 0; j < kList.length; j++) {
      if (eList[i].brand !== kList[j].brand) continue;

      var sum = eList[i].price + kList[j].price;
      if (sum <= budget) {
        sameBrandPlans.push({
          earphone: eList[i],
          keyboard: kList[j],
          total: sum,
          remaining: budget - sum,
          sameBrand: true,
          brand: eList[i].brand
        });
      }
    }
  }

  // 按总价从高到低排（贵的通常配置更好，在预算内选最贵的更划算）
  sameBrandPlans.sort(function (a, b) { return b.total - a.total; });

  // 第 3 步：如果同品牌有方案，看看剩下的钱能不能再买个配件
  if (sameBrandPlans.length > 0) {
    var best = sameBrandPlans[0];

    var accessoryPlan = null;
    if (best.remaining > 0) {
      var accessories = await toolSearchProducts({
        category: 'accessory',
        maxPrice: best.remaining,
        sort: 'price_desc',
        limit: 3
      });
      steps.push({
        name: 'searchProducts',
        args: JSON.stringify({ category: 'accessory', maxPrice: best.remaining }),
        result: '在剩余 ¥' + utils.formatPrice(best.remaining) + ' 内找配件：' +
                accessories.total + ' 个'
      });

      if (accessories.items.length > 0) {
        accessoryPlan = accessories.items[0];
      }
    }

    // 组装回复
    var lines = [];
    lines.push('我帮你算了一下 预算 ¥' + utils.formatPrice(budget) + '，同品牌组合的最优解是：');
    lines.push('');
    lines.push('【方案一 · 同品牌推荐】');
    lines.push('· 耳机：' + best.earphone.name + ' — ¥' + utils.formatPrice(best.earphone.price));
    lines.push('· 键盘：' + best.keyboard.name + ' — ¥' + utils.formatPrice(best.keyboard.price));
    lines.push('· 品牌：' + best.brand + '（两者同品牌）');
    lines.push('· 合计：¥' + utils.formatPrice(best.total) +
               '，预算剩余 ¥' + utils.formatPrice(best.remaining));

    if (accessoryPlan) {
      lines.push('');
      lines.push('剩下 ¥' + utils.formatPrice(best.remaining) + ' 还可以加一个配件：');
      lines.push('· ' + accessoryPlan.name + ' — ¥' + utils.formatPrice(accessoryPlan.price));
      lines.push('· 三件合计：¥' + utils.formatPrice(best.total + accessoryPlan.price) +
                 '，还剩 ¥' + utils.formatPrice(budget - best.total - accessoryPlan.price));
    } else if (best.remaining > 0) {
      lines.push('');
      lines.push('剩下的 ¥' + utils.formatPrice(best.remaining) +
                 ' 内暂时没有合适的配件，不过可以留着。');
    }

    // 给出备选方案
    if (sameBrandPlans.length > 1) {
      var alt = sameBrandPlans[1];
      lines.push('');
      lines.push('【方案二 · 更省钱的同品牌组合】');
      lines.push('· ' + alt.earphone.name + ' — ¥' + utils.formatPrice(alt.earphone.price));
      lines.push('· ' + alt.keyboard.name + ' — ¥' + utils.formatPrice(alt.keyboard.price));
      lines.push('· 合计：¥' + utils.formatPrice(alt.total) +
                 '，可省下 ¥' + utils.formatPrice(best.total - alt.total));
    }

    lines.push('');
    lines.push('推荐理由：方案一在预算内选了同品牌里配置更高的组合，' +
               '同品牌的外设通常驱动和生态更统一，用起来更省心。');

    var productsToShow = [best.earphone, best.keyboard];
    if (accessoryPlan) productsToShow.push(accessoryPlan);

    return { text: lines.join('\n'), products: productsToShow, steps: steps };
  }

  /* ---------- 没有同品牌方案：给出替代方案，而不是简单说"找不到" ---------- */
  steps.push({
    name: 'solveConstraints',
    args: JSON.stringify({ budget: budget }),
    result: '同品牌无解，改算跨品牌最省组合'
  });

  // 跨品牌最优：分别取最便宜的
  var cheapestE = eList.length > 0 ? eList[0] : null;
  var cheapestK = kList.length > 0 ? kList[0] : null;
  var crossPlans = [];

  for (var a = 0; a < eList.length; a++) {
    for (var b = 0; b < kList.length; b++) {
      var total2 = eList[a].price + kList[b].price;
      if (total2 <= budget) {
        crossPlans.push({
          earphone: eList[a],
          keyboard: kList[b],
          total: total2,
          remaining: budget - total2
        });
      }
    }
  }
  crossPlans.sort(function (x, y) { return y.total - x.total; });

  var out = [];
  out.push('我认真算了一下，在 ¥' + utils.formatPrice(budget) + ' 预算内**没有同一品牌**的耳机 + 键盘组合');
  out.push('');
  out.push('原因是：云巢的耳机和键盘都有，但声阔的耳机偏贵、键盘不便宜，两边价格凑不到一起。');
  out.push('');
  out.push('给你 3 个替代方案：');
  out.push('');

  if (crossPlans.length > 0) {
    var p1 = crossPlans[0];
    out.push('【替代方案 1 · 预算内配置最高（不同品牌）】');
    out.push('· ' + p1.earphone.name + ' — ¥' + utils.formatPrice(p1.earphone.price));
    out.push('· ' + p1.keyboard.name + ' — ¥' + utils.formatPrice(p1.keyboard.price));
    out.push('· 合计 ¥' + utils.formatPrice(p1.total) +
             '，剩余 ¥' + utils.formatPrice(p1.remaining));
    out.push('· 取舍：放弃同品牌，但两件都是各自价位里配置最好的。');
    out.push('');
  }

  if (crossPlans.length > 1) {
    var p2 = crossPlans[crossPlans.length - 1];
    out.push('【替代方案 2 · 最省钱】');
    out.push('· ' + p2.earphone.name + ' — ¥' + utils.formatPrice(p2.earphone.price));
    out.push('· ' + p2.keyboard.name + ' — ¥' + utils.formatPrice(p2.keyboard.price));
    out.push('· 合计 ¥' + utils.formatPrice(p2.total) +
             '，能省下 ¥' + utils.formatPrice(budget - p2.total));
    out.push('· 取舍：配件预算充足，但耳机/键盘的配置会低一些。');
    out.push('');
  }

  out.push('【替代方案 3 · 先买一件】');
  out.push('· 提高预算到 ¥1200 左右，就能凑出声阔的同品牌组合；');
  out.push('· 或者先买耳机，键盘下次再买。');
  out.push('');
  out.push('你更看重"同品牌"还是"配置"？我可以按你的偏好再算一遍。');

  var showProducts = [];
  if (crossPlans.length > 0) {
    showProducts.push(crossPlans[0].earphone, crossPlans[0].keyboard);
  }
  if (crossPlans.length > 1) {
    var last = crossPlans[crossPlans.length - 1];
    if (showProducts.indexOf(last.earphone) === -1) showProducts.push(last.earphone);
    if (showProducts.indexOf(last.keyboard) === -1) showProducts.push(last.keyboard);
  }

  return { text: out.join('\n'), products: showProducts, steps: steps };
}

/* ============================================================
   六、文案生成的小工具
   ============================================================ */

/**
 * 从用户的话里提取搜索关键词（去掉"帮我找""推荐"这些没用的词）
 */
function extractSearchKeyword(text) {
  var stopWords = [
    '帮我', '找', '推荐', '一个', '一款', '有没有', '有吗', '想买', '要买',
    '看看', '的', '吗', '呢', '吧', '啊', '元以内', '以内', '适合', '好的',
    '请问', '一下', '什么', '比较', '我', '要', '想'
  ];

  var result = text;
  for (var i = 0; i < stopWords.length; i++) {
    // split + join 相当于"全部替换"
    result = result.split(stopWords[i]).join('');
  }
  result = result.replace(/\d+/g, '').trim();

  // 太短了就不当关键词用（避免搜出奇怪的结果）
  return result.length >= 2 ? result : '';
}

/**
 * 生成"推荐商品"的回复文案（带理由 —— 考核 9.5 第 3 条）
 */
function buildRecommendText(need, result, totalMatched) {
  var lines = [];
  var total = totalMatched || result.total;

  if (need.category && need.budget) {
    lines.push('在 ¥' + utils.formatPrice(need.budget) + ' 以内的' +
               components.getCategoryName(need.category) + '里，我筛出 ' + total + ' 款，' +
               '帮你挑了这 3 个：');
  } else if (need.category) {
    lines.push(components.getCategoryName(need.category) + '一共有 ' + total + ' 款，' +
               '我按口碑帮你挑了这 3 个：');
  } else if (need.budget) {
    lines.push('¥' + utils.formatPrice(need.budget) + ' 以内共 ' + total + ' 款，' +
               '我挑了这 3 个：');
  } else {
    lines.push('相关商品共 ' + total + ' 款，我挑了这 3 个：');
  }

  lines.push('');

  var showCount = Math.min(3, result.items.length);
  for (var i = 0; i < showCount; i++) {
    var p = result.items[i];
    lines.push((i + 1) + '. ' + p.name + ' — ¥' + utils.formatPrice(p.price) +
               '  ' + utils.renderStars(p.rating) + ' ' + p.rating);
    lines.push('   ' + p.tagline);
  }

  lines.push('');
  lines.push('挑这几款是因为它们评分最高、口碑最稳。');

  // 主动告诉用户还有更多选择，方便继续追问
  if (total > showCount) {
    lines.push('');
    lines.push('另外还有 ' + (total - showCount) + ' 款没列出来。你可以说：');
    lines.push('· "有没有便宜一点的" —— 我帮你找更省钱的');
    lines.push('· "评分最高的是哪个" —— 我帮你排个序');
  }

  return lines.join('\n');
}

/**
 * 没搜到结果时的回复
 */
function buildNoResultText(need) {
  var parts = ['抱歉，'];

  if (need.budget) {
    parts.push('¥' + utils.formatPrice(need.budget) + ' 以内');
  }
  if (need.category) {
    parts.push('的' + components.getCategoryName(need.category));
  } else {
    parts.push('符合这个条件的商品');
  }
  parts.push('暂时没有找到\n\n');

  parts.push('几个建议：\n');
  if (need.budget) {
    parts.push('· 把预算提高一点试试，比如 ¥' + utils.formatPrice(Math.round(need.budget * 1.5)) + ' 以内\n');
  }
  parts.push('· 换个分类看看，比如耳机、键盘、充电储能\n');
  parts.push('· 或者告诉我你主要用来做什么，我帮你换个思路挑');

  return parts.join('');
}

/* ============================================================
   七、界面渲染
   ============================================================ */

/**
 * 往聊天区追加一条消息
 * @param {string} role 'user' | 'assistant'
 * @param {string} text 文字内容
 * @param {Array} products 可选，附带展示的商品卡片
 * @param {Array} steps 可选，工具调用过程（当前不在界面上展示，仅保留数据）
 */
function appendMessage(role, text, products, steps) {
  var body = utils.$('#agentBody');
  if (!body) return null;

  var el = document.createElement('div');
  el.className = 'msg msg-' + role;

  var avatarHtml = role === 'assistant'
    ? '<div class="msg-avatar">' + window.icons.icon('sparkles', 15) + '</div>'
    : '';

  /* 关于工具调用过程（steps）：
     ------------------------------------------------------------
     之前这里会渲染一个「执行了 N 个步骤」的可折叠面板，
     现在按需求去掉了 —— 界面上只保留对话内容和商品卡片，更干净。

     但 steps 数据仍然在产生和传递（见 runIntent 里的 steps.push），
     只是不再显示。这样做的好处：
     1. 想恢复这个功能，只要把下面的渲染代码加回来
     2. 调试时可以在 Console 里看 window.agent.state 追踪工具调用
     3. 以后接真模型做「可观测性」（考核 9.8 的 Trace 要求）时，
        这批数据是现成的
  */

  // 商品卡片
  var productsHtml = '';
  if (products && products.length > 0) {
    var cards = '';
    for (var j = 0; j < products.length; j++) {
      var p = products[j];
      cards +=
        '<div class="msg-product">' +
          '<img src="' + utils.escapeHtml(p.image) + '" alt="" loading="lazy" />' +
          '<div class="msg-product-info">' +
            '<div class="msg-product-name">' + utils.escapeHtml(p.name) + '</div>' +
            '<div class="msg-product-price">¥' + utils.formatPrice(p.price) + '</div>' +
          '</div>' +
          '<button class="msg-product-add" type="button" data-add-cart="' + p.id + '">加购</button>' +
        '</div>';
    }
    productsHtml = '<div class="msg-products">' + cards + '</div>';
  }

  el.innerHTML =
    avatarHtml +
    '<div>' +
      '<div class="msg-bubble">' + utils.escapeHtml(text) + '</div>' +
      productsHtml +
    '</div>';

  body.appendChild(el);
  scrollToBottom();
  return el;
}

/**
 * 显示"正在输入"的三点动画
 */
function appendTyping() {
  var body = utils.$('#agentBody');
  if (!body) return null;

  var el = document.createElement('div');
  el.className = 'msg msg-assistant';
  el.setAttribute('data-typing', '1');
  el.innerHTML =
    '<div class="msg-avatar">' + window.icons.icon('sparkles', 15) + '</div>' +
    '<div class="msg-bubble">' +
      '<span class="typing-dots"><span></span><span></span><span></span></span>' +
    '</div>';

  body.appendChild(el);
  scrollToBottom();
  return el;
}

function removeTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function scrollToBottom() {
  var body = utils.$('#agentBody');
  if (body) {
    body.scrollTop = body.scrollHeight;
  }
}

/**
 * 渲染快捷问题 Chips
 */
function renderChips() {
  var el = utils.$('#agentChips');
  if (!el) return;

  var html = '';
  for (var i = 0; i < AGENT_QUICK_CHIPS.length; i++) {
    html += '<button class="chip" type="button" data-chip="' +
            utils.escapeHtml(AGENT_QUICK_CHIPS[i]) + '">' +
            utils.escapeHtml(AGENT_QUICK_CHIPS[i]) + '</button>';
  }
  el.innerHTML = html;
}

/**
 * 设置"正在思考"的状态
 */
function setBusy(busy) {
  agentState.isBusy = busy;

  var sendBtn = utils.$('#agentSend');
  var input = utils.$('#agentInput');
  var status = utils.$('#agentStatus');

  if (sendBtn) sendBtn.disabled = busy;
  if (input) input.disabled = busy;
  if (status) status.textContent = busy ? '正在思考…' : '在线 · 基于商城真实商品推荐';
}

/* ============================================================
   八、打开 / 关闭
   ============================================================ */

function openAgent() {
  var panel = utils.$('#agentPanel');
  var fab = utils.$('#agentFab');
  if (!panel) return;

  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  if (fab) fab.style.display = 'none';

  // 首次打开时显示欢迎语
  if (agentState.messages.length === 0) {
    appendMessage(
      'assistant',
      '你好！我是云巢商城的 AI 购物助手。\n\n' +
      '我可以帮你：\n' +
      '· 按预算和需求找商品\n' +
      '· 比较不同商品的差别\n' +
      '· 帮你加购物车、下单（会先跟你确认）\n\n' +
      '所有推荐都基于商城的真实商品数据，不会瞎编。\n' +
      '试试问我："500 元以内的运动耳机有吗？"'
    );
    agentState.messages.push({ role: 'assistant', content: '欢迎语' });
  }

  // 自动聚焦输入框
  var input = utils.$('#agentInput');
  if (input) {
    setTimeout(function () { input.focus(); }, 200);
  }
}

function closeAgent() {
  var panel = utils.$('#agentPanel');
  var fab = utils.$('#agentFab');
  if (!panel) return;

  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  if (fab) fab.style.display = '';
}

function toggleAgent() {
  var panel = utils.$('#agentPanel');
  if (!panel) return;
  if (panel.classList.contains('is-open')) {
    closeAgent();
  } else {
    openAgent();
  }
}

/* ============================================================
   九、初始化
   ============================================================ */

function initAgent() {
  var fab = utils.$('#agentFab');
  if (fab) fab.addEventListener('click', toggleAgent);

  var closeBtn = utils.$('#agentClose');
  if (closeBtn) closeBtn.addEventListener('click', closeAgent);

  // 快捷问题点击
  var chips = utils.$('#agentChips');
  if (chips) {
    chips.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-chip]');
      if (!chip) return;
      handleUserMessage(chip.getAttribute('data-chip'));
    });
  }

  // 发送消息
  var form = utils.$('#agentForm');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = utils.$('#agentInput');
      var text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      handleUserMessage(text);
    });
  }

  renderChips();
}

// 挂到 window.agent
window.agent = {
  init: initAgent,
  open: openAgent,
  close: closeAgent,
  toggle: toggleAgent,
  send: handleUserMessage,
  state: agentState,
  // 暴露工具，方便以后接真模型时复用
  tools: {
    searchProducts: toolSearchProducts,
    getProduct: toolGetProduct,
    getCart: toolGetCart,
    addToCart: toolAddToCart,
    updateCartItem: toolUpdateCartItem,
    removeFromCart: toolRemoveFromCart,
    createOrder: toolCreateOrder
  }
};
