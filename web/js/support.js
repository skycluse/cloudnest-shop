/* ============================================================
   support.js —— AI 客服（顶部入口）
   ------------------------------------------------------------
   【它和右下角的「AI 购物助手」有什么区别？】

   两个都是 Agent，但职责不同：

   AI 购物助手（agent.js，右下角浮窗）
     · 帮用户挑商品、比价、组合购买
     · 能加购物车、下单
     · 核心是"导购 + 帮买"

   AI 客服（这个文件，顶部入口）
     · 回答配送、退换、保修、发票、账号这类售后问题
     · 能查用户自己的订单状态
     · 核心是"答疑 + 售后"

   为什么不合并成一个？
   1. 用户的心智模型不同：买东西和"东西出问题了"是两件事
   2. 客服话术需要严谨（政策不能说错），导购话术可以活泼
   3. 两个都能独立改动、独立评估，互不影响

   【底层能力怎么复用？】
   商品查询、加购物车、下单这些工具都调用 window.agent.tools，
   不重复实现。客服只是多了一套自己的知识库和话术。

   【为什么客服能"看到"用户的订单？】
   它不读前端缓存，而是问后端 /api/support/my-orders，
   由后端根据登录凭证判断"你是谁"，只返回你自己的订单。
   这样既不泄露别人的订单，也不用在前端存敏感数据。
   ============================================================ */

/* ============================================================
   一、状态
   ============================================================ */

var supportState = {
  messages: [],          // 对话历史 [{role, content}]
  faq: [],               // 从后端加载的常见问题
  faqLoaded: false,
  isBusy: false,
  // 待用户确认的写操作（加购 / 下单），和购物助手一样需要确认
  pendingAction: null,
  // 上一轮推荐过的商品，供"就买第一个"这类追问使用
  lastRecommended: []
};

/* ============================================================
   二、初始化
   ============================================================ */

/**
 * 加载常见问题库。
 * 加载失败不影响使用 —— 客服还能查商品、查订单，
 * 只是没法回答政策类问题，会引导用户换个问法。
 */
async function loadFaq() {
  if (supportState.faqLoaded) return;

  try {
    supportState.faq = await window.api.request('/support/faq');
    supportState.faqLoaded = true;
  } catch (err) {
    console.warn('常见问题加载失败：', err.message);
    supportState.faq = [];
  }
}

/**
 * 页面加载时调用一次
 */
function initSupport() {
  // 顶部导航的客服入口
  var trigger = utils.$('#supportTrigger');
  if (trigger) {
    trigger.addEventListener('click', toggleSupport);
  }

  // 面板上的关闭按钮
  var closeBtn = utils.$('#supportClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSupport);
  }

  // 遮罩（手机上点空白处关闭）
  var mask = utils.$('#supportMask');
  if (mask) {
    mask.addEventListener('click', closeSupport);
  }

  /* ---------- 快捷问题（两处）----------
     ------------------------------------------------------------
     面板里有两处快捷问题：
     1. 底部固定的一条（#supportChips）
     2. 每条回复下方动态生成的追问（#supportBody 里的 .support-quick）

     【踩过的坑】最初事件只绑在 #supportChips 上，
     结果消息下方的追问按钮点了没反应 —— 因为它们在 #supportBody 里，
     根本没在监听范围内。

     现在改成绑在整个面板上，#supportChips 和 #supportBody 里
     所有 [data-question] 都能被捕获。
     这样以后再加别处的快捷问题也不用改代码。
  */
  var panel = utils.$('#supportPanel');
  if (panel) {
    panel.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-question]');
      if (!chip) return;

      // 处理中就别让重复点击排队，避免连点刷出一堆回复
      if (supportState.isBusy) return;

      handleSupportMessage(chip.getAttribute('data-question'));
    });
  }

  // 发送
  var form = utils.$('#supportForm');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = utils.$('#supportInput');
      var text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      handleSupportMessage(text);
    });
  }

  // 先异步把知识库拉下来，不阻塞页面
  loadFaq();
}

/* ============================================================
   三、意图识别
   ------------------------------------------------------------
   客服要识别的问题类型比购物助手更"事务性"：
   查订单、退换货、保修、发票、配送……

   这里用"关键词加权"而不是简单的包含判断：
   命中的关键词越长，说明越精确，优先级越高。
   比如"什么时候退款"同时命中"退款"和"什么时候退款"，
   前者短、后者长，应该算后者的分数。
   ============================================================ */

// 意图优先级：越靠前越优先判断
var SUPPORT_INTENTS = [
  // ---- 查订单（要落到具体数据）----
  {
    type: 'check_order',
    patterns: [
      /我的订单/, /订单.*(到哪|状态|怎么样|怎么样|查询|查一下)/, /查.*订单/,
      /我买的东西/, /物流到哪/, /快递到哪/, /发货了没/, /到货了吗/, /(查|看).*物流/
    ]
  },
  // ---- 查购物车 ----
  {
    type: 'check_cart',
    patterns: [/购物车/, /我选了什么/, /购物篮/]
  },
  // ---- 下单（必须排在加购前面，否则"帮我下单"会被当成加购）----
  {
    type: 'create_order',
    patterns: [
      /(帮我|给我|直接)?\s*(下单|结账|结算|提交订单|付款|买下来)/,
      /(全部|都)\s*(买|下单)/,
      /我\s*要\s*买\s*了/
    ]
  },
  // ---- 加购（写操作，要确认）----
  {
    type: 'add_to_cart',
    patterns: [
      /帮我.*(买|加购|加入购物车)/, /(买|要)这(个|款)/, /就买/, /帮我买/,
      /加(到|进|入)?购物车/, /把.*(加|放).*购物车/
    ]
  },
  // ---- 找商品（复用购物助手的工具）----
  {
    type: 'find_product',
    patterns: [
      /(有没有|有吗|有木有)/, /(推荐|想要|想买|找一?个|找个|求推荐)/, /多少钱/,
      /(元|块).*(以内|以下|左右|内)/, /预算/
    ]
  },
  // ---- 超范围（先判，避免被别的规则抢走）----
  {
    type: 'out_of_scope',
    patterns: [
      /写\s*(个|一段|一个)?\s*(代码|函数|程序|脚本)/,
      /(帮|替)我\s*写\s*/,
      /写\s*(python|java|javascript|js|go|c\+\+|sql)/i,
      /(天气|气温|股票|汇率|彩票|算命|星座)/,
      /(讲|说)\s*(个|一个)?\s*(笑话|故事)/,
      /(翻译|写作文|写论文|做数学题|化学|物理题)/
    ]
  },
  // ---- 提示词注入 ----
  {
    type: 'prompt_injection',
    patterns: [
      /忽略\s*(你)?\s*(之前|以上|前面|所有)?\s*(的)?\s*(指令|设定|规则)/,
      /(忘记|忘掉|清除)\s*(你)?\s*(的)?\s*(指令|设定|规则|身份)/,
      /(你\s*现在\s*是|假装\s*你\s*是|扮演)/,
      /(把|将)\s*(价格|价钱)\s*(改|设|调)\s*(成|为)/,
      /\d+\s*元?\s*卖\s*(给)?\s*我/,
      /(免费|白送|不要钱)\s*(给)?\s*(我|送)/,
      /(系统提示词|system\s*prompt|越狱|jailbreak)/i,
      /(无视|不要管|绕过)\s*(规则|限制|设定)/
    ]
  },
  // ---- 确认 / 取消 ----
  { type: 'confirm', patterns: [/^(好|好的|可以|行|嗯|确认|确定|同意|要|买吧|下单吧|yes|ok)$/] },
  { type: 'cancel', patterns: [/^(不用|不要|取消|算了|不买|no)$/] },
  // ---- 闲聊寒暄 ----
  {
    type: 'greeting',
    patterns: [/^(你好|您好|hi|hello|在吗|有人吗|哈喽)/i, /^(谢谢|感谢|多谢|3q|thanks)/i]
  }
];

/**
 * 判断用户想问什么
 * @param {string} text
 * @returns {string} 意图类型
 */
function decideSupportIntent(text) {
  var t = String(text || '').trim();
  var lower = t.toLowerCase();

  // 统一转小写但保留中文（中文不受 toLowerCase 影响）
  for (var i = 0; i < SUPPORT_INTENTS.length; i++) {
    var group = SUPPORT_INTENTS[i];
    for (var j = 0; j < group.patterns.length; j++) {
      if (group.patterns[j].test(lower)) {
        return group.type;
      }
    }
  }

  // 没匹配到明确意图时，先试着匹配知识库
  if (matchFaq(t)) {
    return 'faq';
  }

  return 'unknown';
}

/**
 * 在知识库里找最匹配的一条。
 *
 * 匹配策略：算出每条问题命中了多少个关键词，命中的关键词有多长，
 * 取分数最高的那条。分数太低就当作没匹配上。
 *
 * 为什么要考虑关键词长度？
 * 因为"退款"（2 字）和"什么时候退款"（6 字）都有可能出现，
 * 后者更精确。如果只数命中个数，短词容易误伤。
 */
function matchFaq(text) {
  if (!supportState.faq || supportState.faq.length === 0) return null;

  var t = String(text || '');
  var best = null;
  var bestScore = 0;

  for (var i = 0; i < supportState.faq.length; i++) {
    var item = supportState.faq[i];
    var score = 0;

    // 标题命中也算分（用户可能直接说"退换货"）
    if (t.indexOf(item.title) !== -1) {
      score += item.title.length * 2;
    }

    for (var k = 0; k < item.keywords.length; k++) {
      var kw = item.keywords[k];
      if (t.indexOf(kw) !== -1) {
        score += kw.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  // 至少要命中一个 2 字以上的词，避免"的""吗"这种误匹配
  return bestScore >= 2 ? best : null;
}

/* ============================================================
   四、主流程：收消息 → 判断意图 → 干活 → 回复
   ============================================================ */

async function handleSupportMessage(text) {
  if (supportState.isBusy) return;

  var trimmed = String(text || '').trim();
  if (!trimmed) return;

  appendSupportMessage('user', trimmed);
  supportState.messages.push({ role: 'user', content: trimmed });

  var typingEl = appendSupportTyping();
  setSupportBusy(true);

  try {
    var intent = decideSupportIntent(trimmed);
    var reply = await runSupportIntent(intent, trimmed);

    removeSupportTyping(typingEl);

    if (reply && reply.text) {
      appendSupportMessage('assistant', reply.text, reply.products, reply.quickReplies);
      supportState.messages.push({ role: 'assistant', content: reply.text });

      if (reply.products && reply.products.length > 0) {
        supportState.lastRecommended = reply.products;
      }
    }
  } catch (err) {
    removeSupportTyping(typingEl);
    console.error('客服处理出错：', err);

    appendSupportMessage(
      'assistant',
      '抱歉，我这边出了点问题：' + err.message + '\n你可以换个问法再试试。'
    );
  } finally {
    setSupportBusy(false);
  }
}

/**
 * 按意图执行
 */
async function runSupportIntent(intent, text) {
  switch (intent) {

    /* ---------- 问候 ---------- */
    case 'greeting':
      return {
        text: '你好，我是云巢商城的客服小云 😊\n\n' +
              '我可以帮你：\n' +
              '· 查订单和物流状态\n' +
              '· 解答退换货、保修、发票、运费的问题\n' +
              '· 帮你找商品、加购物车、下单\n\n' +
              '有什么可以帮你的？',
        quickReplies: ['我的订单到哪了', '怎么退货', '运费怎么算']
      };

    /* ---------- 超范围 ---------- */
    case 'out_of_scope':
      return {
        text: '不好意思，我是云巢商城的客服，只能处理商城相关的问题 😊\n\n' +
              '你可以问我：\n' +
              '· 我的订单到哪了\n' +
              '· 怎么退货 / 保修多久\n' +
              '· 推荐一款 500 元以内的耳机\n\n' +
              '如果是要买商品，也可以找右下角的「AI 购物助手」。',
        quickReplies: ['我的订单到哪了', '退换货政策', '推荐耳机']
      };

    /* ---------- 提示词注入 ---------- */
    case 'prompt_injection':
      return {
        text: '这个我没法照做 🙅\n\n' +
              '所有商品价格都来自商城的真实数据，我不能修改价格，' +
              '也不能给出违反规则的承诺。\n\n' +
              '如果你有购物或售后方面的需求，我很乐意帮忙。',
        quickReplies: ['退换货政策', '推荐耳机']
      };

    /* ---------- 查订单 ---------- */
    case 'check_order':
      return await answerOrderStatus();

    /* ---------- 查购物车 ---------- */
    case 'check_cart':
      return answerCart();

    /* ---------- 下单（写操作，必须先确认）---------- */
    case 'create_order':
      return await answerCreateOrder();

    /* ---------- 加购物车（写操作，必须先确认）---------- */
    case 'add_to_cart':
      return await answerAddToCart(text);

    /* ---------- 找商品 ---------- */
    case 'find_product':
      return await answerFindProduct(text);

    /* ---------- 确认 ---------- */
    case 'confirm':
      if (!supportState.pendingAction) {
        return { text: '好的。还需要我帮你做什么？' };
      }
      return await executePendingSupportAction();

    /* ---------- 取消 ---------- */
    case 'cancel':
      if (supportState.pendingAction) {
        supportState.pendingAction = null;
        return { text: '好的，已经取消了。还有别的需要帮忙吗？' };
      }
      return { text: '好的，有需要随时找我。' };

    /* ---------- 知识库命中 ---------- */
    case 'faq': {
      var item = matchFaq(text);
      if (item) return answerFaq(item);
      return answerUnknown();
    }

    default:
      return answerUnknown();
  }
}

/* ============================================================
   五、各类问题的回答
   ============================================================ */

/**
 * 回答知识库里的问题
 */
function answerFaq(item) {
  return {
    text: item.answer,
    // 相关追问，引导用户继续
    quickReplies: item.related && item.related.length > 0
      ? item.related.slice(0, 3)
      : ['还有什么可以帮你的']
  };
}

/**
 * 查订单状态
 * ------------------------------------------------------------
 * 关键：数据必须来自后端真实订单，不能靠猜。
 * 没登录就明确说"请先登录"，而不是编一个出来。
 */
async function answerOrderStatus() {
  if (!window.auth || !window.auth.isLoggedIn()) {
    return {
      text: '查询订单需要登录哦。\n\n' +
            '因为订单是私人的信息，只能查自己的。\n' +
            '点右上角「登录」登录后，再来问我就可以了。',
      quickReplies: ['怎么注册', '为什么必须登录']
    };
  }

  var orders;
  try {
    orders = await window.api.request('/support/my-orders');
  } catch (err) {
    if (err.status === 401) {
      return {
        text: '你的登录状态好像过期了，麻烦重新登录一下，我才能帮你查订单。',
        quickReplies: ['怎么注册']
      };
    }
    throw err;
  }

  if (!orders || orders.length === 0) {
    return {
      text: '你的账号下还没有订单。\n\n' +
            '去商城挑几件喜欢的商品吧，下单后就能在这里查到订单状态了。',
      quickReplies: ['推荐耳机', '推荐键盘']
    };
  }

  var lines = ['你最近有 ' + orders.length + ' 笔订单：', ''];

  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var itemNames = o.items.map(function (it) {
      return it.name + ' × ' + it.quantity;
    }).join('、');

    lines.push((i + 1) + '. 订单号 ' + o.id);
    lines.push('   ' + itemNames);
    lines.push('   状态：' + (o.statusText || o.status) +
               '　金额：¥' + utils.formatPrice(o.totalPrice));
    lines.push('   下单时间：' + utils.formatDateTime(o.createdAt));
    lines.push('');
  }

  lines.push('这是演示项目，订单状态固定为「已支付（模拟）」。');
  lines.push('发货时间参考：付款后 48 小时内发出，一般 2~4 天送达。');

  return {
    text: lines.join('\n'),
    quickReplies: ['发货时间', '怎么退货', '改收货地址']
  };
}

/**
 * 查购物车
 */
function answerCart() {
  var items = cart.getItems();

  if (!items || items.length === 0) {
    return {
      text: '你的购物车现在是空的。\n\n要我帮你推荐点东西吗？',
      quickReplies: ['推荐耳机', '推荐键盘', '推荐充电宝']
    };
  }

  var lines = ['你的购物车里有 ' + cart.getTotalCount() + ' 件商品：', ''];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    lines.push('· ' + it.name + ' × ' + it.quantity +
               '　¥' + utils.formatPrice(it.price * it.quantity));
  }
  lines.push('');
  lines.push('合计：¥' + utils.formatPrice(cart.getTotalPrice()));

  return {
    text: lines.join('\n'),
    quickReplies: ['帮我下单', '怎么付款']
  };
}

/**
 * 处理"帮我买"这类请求
 * ------------------------------------------------------------
 * 【这一段的重点：Agent 要能"指得准"用户说的是哪件商品】
 *
 * 用户可能这样表达：
 *   "帮我买第二个"        → 按序号
 *   "就买那个" / "这款"    → 指刚才推荐的第一件
 *   "帮我买个耳机"         → 按品类去搜
 *   "买 声阔 Liberty"      → 指名道姓
 *
 * 如果只认第一种或只认最后一种，就会出现
 * "我没找到你说的商品" 这种让人抓狂的回答。
 *
 * 【写操作必须确认】
 * 这里只准备动作，不真正执行。真正执行在 executePendingSupportAction()，
 * 必须等用户回"确认"。
 */
async function answerAddToCart(text) {
  if (!window.auth || !window.auth.isLoggedIn()) {
    return {
      text: '加购物车和下单都需要先登录哦。\n\n' +
            '点右上角「登录」登录后，我就能帮你操作了。',
      quickReplies: ['怎么注册', '为什么必须登录']
    };
  }

  var target = await resolveTargetProduct(text);

  if (!target.product) {
    return {
      text: target.message || '我没找到你说的商品，可以说得更具体一点吗？',
      quickReplies: ['推荐耳机', '推荐键盘']
    };
  }

  var p = target.product;
  var quantity = target.quantity || 1;

  // 只准备动作，不执行
  supportState.pendingAction = {
    type: 'add_to_cart',
    productId: p.id,
    productName: p.name,
    quantity: quantity
  };

  return {
    text: '好的，我准备把「' + p.name + '」（¥' +
          utils.formatPrice(p.price) + '）' +
          (quantity > 1 ? ' × ' + quantity : '') +
          '加入购物车。\n\n' +
          '确认要加购吗？回复"确认"就行。',
    products: [p],
    quickReplies: ['确认', '算了']
  };
}

/* ============================================================
   商品指代解析
   ------------------------------------------------------------
   把"第二个""刚才那款""声阔那个"这类说法，解析成具体商品。
   这是 Agent "听得懂人话"的关键一步。
   ============================================================ */

// 中文数字 → 阿拉伯数字，用于"第二个""第三款"
var CN_NUM = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10
};

/**
 * 从话里提取序号，比如"买第二个"→ 2，"要第三款"→ 3
 * 找不到返回 0。
 */
function extractOrdinal(text) {
  // 匹配"第二个""第3款""第 2 个"
  var m = text.match(/第\s*([一二三四五六七八九十\d]{1,2})\s*(个|款|种|件|样)/);
  if (m) {
    return CN_NUM[m[1]] || 0;
  }

  // "买 2 个"这种容易和数量混淆，不在这里处理

  // "最后一个" / "最便宜那个" 这类暂不支持，返回 0 交给后续逻辑
  return 0;
}

/**
 * 解析出用户想买的具体商品
 * @returns {Promise<{product, quantity?, message?}>}
 */
async function resolveTargetProduct(text) {
  var rec = supportState.lastRecommended || [];
  var quantity = extractQuantity(text);

  /* ---- ① 按序号指代：第二个 / 第3款 ---- */
  var ordinal = extractOrdinal(text);
  if (ordinal > 0) {
    if (rec.length === 0) {
      return { message: '我这边没有可以点的商品列表，你先让我推荐一下，比如"推荐一个500元以内的耳机"。' };
    }
    if (ordinal > rec.length) {
      return {
        message: '刚才我只推荐了 ' + rec.length + ' 个，你说的第 ' + ordinal +
                 ' 个超出了范围。可以看第一个到第 ' + rec.length + ' 个。'
      };
    }
    return { product: rec[ordinal - 1], quantity: quantity };
  }

  /* ---- ② 指代"刚才那款/这个/它" ---- */
  if (/这个|这款|那个|那款|它|刚才|上面|推荐的那/.test(text) && rec.length > 0) {
    return { product: rec[0], quantity: quantity };
  }

  /* ---- ③ 在刚才推荐的列表里按名字模糊找 ---- */
  if (rec.length > 0) {
    for (var i = 0; i < rec.length; i++) {
      // 取商品名里比较有辨识度的部分来比对
      var name = rec[i].name;
      var brand = rec[i].brand || '';
      var model = name.replace(brand, '').split(' ')[0];  // 去掉品牌前缀取型号

      if (text.indexOf(name) !== -1 ||
          (model.length >= 2 && text.indexOf(model) !== -1) ||
          (brand && text.indexOf(brand) !== -1 && rec.length === 1)) {
        return { product: rec[i], quantity: quantity };
      }
    }
  }

  /* ---- ④ 还没锁定，去商品库搜 ---- */
  var keyword = extractSupportKeyword(text);
  var params = { sort: 'rating', pageSize: 3 };
  if (keyword) params.keyword = keyword;

  var category = extractSupportCategory(text);
  if (category) params.category = category;

  var result = await window.agent.tools.searchProducts(params);

  if (!result.items || result.items.length === 0) {
    return { message: '我没找到你说的商品，可以说得更具体一点吗？\n比如"帮我买个耳机"。' };
  }

  // 如果搜出来不止一个，先让用户确认是哪一个，不要擅自决定
  if (result.items.length > 1 && !keyword && !category) {
    return { message: '你想买的是哪一件？可以说"第二个"或者直接说商品名。' };
  }

  return { product: result.items[0], quantity: quantity };
}

/**
 * 提取数量："买两个" → 2，"要3个" → 3
 */
function extractQuantity(text) {
  var m = text.match(/([一二三四五六七八九十\d])\s*(个|件|台|只|副)/);
  if (!m) return 1;

  // "第三个"里的"个"不是数量，要排除
  if (/第\s*[一二三四五六七八九十\d]\s*个/.test(text)) return 1;

  var n = CN_NUM[m[1]] || 1;
  return n >= 1 && n <= 10 ? n : 1;
}

/**
 * 执行待确认的操作
 * ------------------------------------------------------------
 * 这里是真正"动手"的地方。加购和下单都在确认后执行，
 * 执行完立刻同步界面状态。
 */
async function executePendingSupportAction() {
  var action = supportState.pendingAction;
  supportState.pendingAction = null;   // 先清掉，防止连点重复执行

  if (!action) {
    return { text: '没有待确认的操作。' };
  }

  /* ---------- 加入购物车 ---------- */
  if (action.type === 'add_to_cart') {
    var added = await window.agent.tools.addToCart(action.productId, action.quantity);

    // 实时同步：打开购物车抽屉，用户能立刻看到结果
    components.openCartDrawer();

    /* 如果用户的原话是"买了"，说明他想一步到位。
       这时候顺着往下问要不要下单，而不是让他再说一遍。 */
    var wantsOrder = action.chainOrder === true;

    return {
      text: '已经加进购物车了 ✅\n\n' +
            '· ' + added.product.name + ' × ' + added.quantity +
            '（¥' + utils.formatPrice(added.product.price * added.quantity) + '）\n\n' +
            (wantsOrder
              ? '需要我直接帮你下单吗？回复"确认"或者"帮我下单"。'
              : '购物车已经在右侧打开了。需要我帮你下单吗？'),
      quickReplies: wantsOrder ? ['确认', '先不买'] : ['帮我下单', '不用了']
    };
  }

  /* ---------- 创建订单 ---------- */
  if (action.type === 'create_order') {
    var order = await window.agent.tools.createOrder();

    // 实时同步：弹出订单结果，订单页也能立刻看到
    components.showOrderResult(order);

    return {
      text: '下单成功 🎉\n\n' +
            '· 订单编号：' + order.id + '\n' +
            '· 商品件数：' + order.itemCount + ' 件\n' +
            '· 订单总价：¥' + utils.formatPrice(order.totalPrice) + '\n' +
            '· 订单状态：' + order.statusText + '\n\n' +
            '订单详情已经弹出来了，也可以到「我的订单」里查看。',
      quickReplies: ['我的订单到哪了', '发货时间']
    };
  }

  return { text: '操作完成。' };
}

/**
 * 处理下单请求
 * ------------------------------------------------------------
 * 下单是最重要的写操作，必须：
 * 1. 检查登录
 * 2. 检查购物车非空
 * 3. 展示购物车摘要（让用户确认买的是什么）
 * 4. 等确认后才真正下单
 */
async function answerCreateOrder() {
  if (!window.auth || !window.auth.isLoggedIn()) {
    return {
      text: '下单需要先登录哦。点右上角「登录」，登录后我就能帮你下单了。',
      quickReplies: ['怎么注册']
    };
  }

  var items = cart.getItems();

  if (!items || items.length === 0) {
    return {
      text: '你的购物车是空的，还没东西可以下单。\n\n' +
            '要我帮你推荐点商品吗？',
      quickReplies: ['推荐耳机', '推荐键盘']
    };
  }

  // 把购物车内容列出来，让用户确认
  var lines = ['你购物车里有 ' + cart.getTotalCount() + ' 件商品：', ''];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    lines.push('· ' + it.name + ' × ' + it.quantity +
               '　¥' + utils.formatPrice(it.price * it.quantity));
  }
  lines.push('');
  lines.push('合计：¥' + utils.formatPrice(cart.getTotalPrice()));
  lines.push('');
  lines.push('确认要下单吗？（这是模拟支付，不会真的扣钱）');

  // 只准备动作，等确认
  supportState.pendingAction = { type: 'create_order' };

  return {
    text: lines.join('\n'),
    quickReplies: ['确认', '算了']
  };
}

/**
 * 找商品 —— 复用购物助手的搜索工具，保证数据一致
 */
async function answerFindProduct(text) {
  var keyword = extractSupportKeyword(text);
  var params = { sort: 'rating', pageSize: 3 };

  // 复用购物助手已经写好的预算 / 分类提取逻辑，
  // 但它是 agent.js 内部的函数，没导出。
  // 这里用一个简单版：识别常见分类词 + 数字预算。
  var budget = extractSupportBudget(text);
  if (budget) params.maxPrice = budget;

  var category = extractSupportCategory(text);
  if (category) params.category = category;
  if (keyword) params.keyword = keyword;

  var result = await window.agent.tools.searchProducts(params);

  if (!result.items || result.items.length === 0) {
    return {
      text: '抱歉，这个条件下我没找到商品。\n\n' +
            '可以试试：\n' +
            '· 提高一点预算\n' +
            '· 换个分类，比如耳机、键盘、鼠标\n' +
            '· 或者直接说"推荐个耳机"，我按口碑帮你挑',
      quickReplies: ['推荐耳机', '推荐键盘', '推荐充电宝']
    };
  }

  var lines = [];
  if (budget) {
    lines.push('在 ¥' + utils.formatPrice(budget) + ' 以内，我帮你挑了这 ' +
               result.items.length + ' 个：');
  } else {
    lines.push('帮你挑了这 ' + result.items.length + ' 个：');
  }
  lines.push('');

  for (var i = 0; i < result.items.length; i++) {
    var p = result.items[i];
    lines.push((i + 1) + '. ' + p.name + ' — ¥' + utils.formatPrice(p.price) +
               '（评分 ' + p.rating + '）');
    lines.push('   ' + p.tagline);
  }

  lines.push('');
  lines.push('这些价格和库存都来自商城实时数据。需要我帮你加购物车吗？');

  return {
    text: lines.join('\n'),
    products: result.items,
    quickReplies: ['帮我加购物车', '怎么付款']
  };
}

/**
 * 兜底：没听懂
 */
function answerUnknown() {
  return {
    text: '这个问题我不太确定该怎么回答 🤔\n\n' +
          '我可以帮你处理这些：\n' +
          '· 查订单和物流\n' +
          '· 退货、换货、保修、发票\n' +
          '· 运费和配送时间\n' +
          '· 找商品、加购物车\n\n' +
          '你可以换个说法，或者点下面的快捷问题试试。',
    quickReplies: ['我的订单到哪了', '怎么退货', '运费怎么算', '推荐耳机']
  };
}

/* ============================================================
   六、文本提取小工具
   ============================================================ */

/**
 * 提取预算上限
 * 支持"500元以内""预算1000""不超过300"
 */
function extractSupportBudget(text) {
  var patterns = [
    /(\d+)\s*(?:元|块|块钱)?\s*(?:以内|以下|左右|之内|内|封顶)/,
    /预算\s*(?:是|为|在)?\s*(\d+)/,
    /(?:不超过|最多|顶顶多|不到)\s*(\d+)/,
    /(\d+)\s*(?:元|块)/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m && m[1]) {
      var n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0 && n < 1000000) return n;
    }
  }
  return null;
}

/**
 * 提取商品分类
 */
function extractSupportCategory(text) {
  var map = [
    { id: 'audio', words: ['耳机', '耳塞', '降噪'] },
    { id: 'keyboard', words: ['键盘', '打字'] },
    { id: 'mouse', words: ['鼠标'] },
    { id: 'power', words: ['充电宝', '充电器', '移动电源'] },
    { id: 'smart', words: ['台灯', '插座', '音箱', '灯'] },
    { id: 'accessory', words: ['支架', '理线', '鼠标垫', '配件'] }
  ];

  for (var i = 0; i < map.length; i++) {
    for (var j = 0; j < map[i].words.length; j++) {
      if (text.indexOf(map[i].words[j]) !== -1) return map[i].id;
    }
  }
  return null;
}

/**
 * 提取搜索关键词（去掉"帮我买""推荐"这些没用的词）
 */
function extractSupportKeyword(text) {
  var stop = [
    '帮我', '买', '推荐', '一个', '一款', '有没有', '有吗', '想买', '要买',
    '看看', '的', '吗', '呢', '吧', '啊', '元以内', '以内', '适合', '好的',
    '请问', '一下', '什么', '比较', '我', '要', '想', '这个', '这款', '加购物车',
    '下单', '吧', '可以', '能'
  ];

  var result = text;
  for (var i = 0; i < stop.length; i++) {
    result = result.split(stop[i]).join('');
  }
  result = result.replace(/\d+/g, '').trim();

  return result.length >= 2 ? result : '';
}

/* ============================================================
   七、界面渲染
   ============================================================ */

/**
 * 追加一条消息
 */
function appendSupportMessage(role, text, products, quickReplies) {
  var body = utils.$('#supportBody');
  if (!body) return null;

  var el = document.createElement('div');
  el.className = 'msg msg-' + role;

  var avatarHtml = role === 'assistant'
    ? '<div class="msg-avatar">' + window.icons.icon('headset', 15) + '</div>'
    : '';

  // 商品卡片（复用购物助手的样式）
  var productsHtml = '';
  if (products && products.length > 0) {
    var cards = '';
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      cards +=
        '<div class="msg-product">' +
          /* 点卡片进商品详情，和购物助手的卡片保持一致 */
          '<a class="msg-product-main" href="./product.html?id=' + p.id + '" title="查看详情">' +
            '<img src="' + utils.escapeHtml(p.image) + '" alt="" loading="lazy" />' +
            '<div class="msg-product-info">' +
              '<div class="msg-product-name">' + utils.escapeHtml(p.name) + '</div>' +
              '<div class="msg-product-price">¥' + utils.formatPrice(p.price) + '</div>' +
            '</div>' +
          '</a>' +
          /* 用 data-add-cart 复用 components.js 里的全局事件委托，
             这样这里的"加购"按钮和商品卡片的加购按钮走同一套逻辑，
             不用再写一遍重复代码。 */
          '<button class="msg-product-add" type="button" ' +
                  'data-add-cart="' + p.id + '">加购</button>' +
        '</div>';
    }
    productsHtml = '<div class="msg-products">' + cards + '</div>';
  }

  // 快捷追问
  var quickHtml = '';
  if (quickReplies && quickReplies.length > 0) {
    var qs = '';
    for (var k = 0; k < quickReplies.length; k++) {
      qs += '<button class="chip" type="button" data-question="' +
            utils.escapeHtml(quickReplies[k]) + '">' +
            utils.escapeHtml(quickReplies[k]) + '</button>';
    }
    quickHtml = '<div class="support-quick">' + qs + '</div>';
  }

  el.innerHTML =
    avatarHtml +
    '<div>' +
      '<div class="msg-bubble">' + utils.escapeHtml(text) + '</div>' +
      productsHtml +
      quickHtml +
    '</div>';

  body.appendChild(el);
  scrollSupportBottom();
  return el;
}

function appendSupportTyping() {
  var body = utils.$('#supportBody');
  if (!body) return null;

  var el = document.createElement('div');
  el.className = 'msg msg-assistant';
  el.innerHTML =
    '<div class="msg-avatar">' + window.icons.icon('headset', 15) + '</div>' +
    '<div class="msg-bubble">' +
      '<span class="typing-dots"><span></span><span></span><span></span></span>' +
    '</div>';

  body.appendChild(el);
  scrollSupportBottom();
  return el;
}

function removeSupportTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function scrollSupportBottom() {
  var body = utils.$('#supportBody');
  if (body) body.scrollTop = body.scrollHeight;
}

/**
 * 设置"正在输入"状态
 */
function setSupportBusy(busy) {
  supportState.isBusy = busy;

  var sendBtn = utils.$('#supportSend');
  var input = utils.$('#supportInput');

  if (sendBtn) sendBtn.disabled = busy;
  if (input) input.disabled = busy;
}

/* ============================================================
   八、打开 / 关闭
   ============================================================ */

function openSupport() {
  var panel = utils.$('#supportPanel');
  var mask = utils.$('#supportMask');
  if (!panel) return;

  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  if (mask) mask.hidden = false;

  /* 给 body 加个标记，CSS 里用它把右下角的 AI 助手按钮藏起来，
     否则那个圆形按钮会压在客服的输入框上。 */
  document.body.classList.add('support-open');

  // 第一次打开时显示欢迎语
  if (supportState.messages.length === 0) {
    appendSupportMessage(
      'assistant',
      '你好，我是云巢商城的客服小云 👋\n\n' +
      '我可以帮你：\n' +
      '· 查订单和物流状态\n' +
      '· 解答退货、换货、保修、发票问题\n' +
      '· 说明运费和发货时间\n' +
      '· 帮你找商品、加购物车\n\n' +
      '所有订单信息都来自你的真实订单，商品信息来自商城实时数据。',
      null,
      ['我的订单到哪了', '怎么退货', '运费怎么算', '推荐一款耳机']
    );
    supportState.messages.push({ role: 'assistant', content: '欢迎语' });
  }

  // 打开时刷新一下知识库（万一后端更新了）
  loadFaq();

  var input = utils.$('#supportInput');
  if (input) {
    setTimeout(function () { input.focus(); }, 250);
  }
}

function closeSupport() {
  var panel = utils.$('#supportPanel');
  var mask = utils.$('#supportMask');
  if (!panel) return;

  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  if (mask) mask.hidden = true;

  // 移除标记，AI 助手按钮会重新出现
  document.body.classList.remove('support-open');
}

function toggleSupport() {
  var panel = utils.$('#supportPanel');
  if (!panel) return;
  if (panel.classList.contains('is-open')) {
    closeSupport();
  } else {
    openSupport();
  }
}

/* ============================================================
   九、导出
   ============================================================ */

window.support = {
  init: initSupport,
  open: openSupport,
  close: closeSupport,
  toggle: toggleSupport,
  send: handleSupportMessage,
  state: supportState,
  // 导出几个纯函数，方便写测试
  _internal: {
    decideIntent: decideSupportIntent,
    matchFaq: matchFaq,
    extractBudget: extractSupportBudget,
    extractCategory: extractSupportCategory,
    extractKeyword: extractSupportKeyword
  }
};
