/**
 * 订单相关接口
 * ------------------------------------------------------------
 * POST /api/orders        创建订单（必须登录）
 * GET  /api/orders/:id    查询单笔订单
 * GET  /api/orders        查询订单列表（必须登录）
 *
 * 【下单必须登录】
 * 按真实电商的标准，下单是需要身份的操作 ——
 * 订单要记到某个账号名下，将来才能查物流、售后、开发票。
 * 所以这里强制要求登录，未登录直接返回 401。
 *
 * 但浏览商品、搜索筛选、加购物车都不需要登录，
 * 用户可以先把东西放购物车，等想结算时再登录。
 * 这是大多数电商的常见做法。
 */

const express = require('express');
const store = require('../store');
const auth = require('../auth');

const router = express.Router();

/**
 * POST /api/orders
 * 请求体：
 * {
 *   "items": [{ "productId": 1, "quantity": 2 }],
 *   "customer": { "name": "张三", "phone": "13800138000", "address": "..." },
 *   "remark": "备注（可选）"
 * }
 */
router.post('/orders', function (req, res) {
  const user = auth.getUserFromRequest(req);

  /* 未登录直接拒绝。
     401 表示"你没有登录"，前端收到 401 会弹出登录框。

     为什么前端也拦了还要在这里再拦一次？
     因为前端拦截只是给人看的体验 ——
     用任何工具（Postman、curl、浏览器控制台）都能绕过前端直接调接口。
     后端才是真正的关卡，安全永远靠后端守。 */
  if (!user) {
    return res.status(401).json({
      code: 401,
      message: '请先登录后再下单'
    });
  }

  const payload = Object.assign({}, req.body);
  // 订单归属以服务端识别出的用户为准，
  // 绝对不能用前端传来的 userId —— 那样谁都能冒充别人下单
  payload.userId = user.id;

  const result = store.createOrder(payload);

  if (!result.ok) {
    // 400 = 客户端传的数据有问题
    return res.status(400).json({ code: 400, message: result.message });
  }

  // 201 = 创建成功
  res.status(201).json({ code: 0, message: '下单成功', data: result.order });
});

/**
 * GET /api/orders/:id
 *
 * 查单笔订单。
 * 单笔查询允许未登录访问（要拿着完整订单号才能查到，
 * 订单号是随机的，猜不到），但登录用户只能查自己的。
 */
router.get('/orders/:id', function (req, res) {
  const order = store.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ code: 404, message: '订单不存在' });
  }

  // 如果这单属于某个用户，那我就必须就是这个用户才能看
  const user = auth.getUserFromRequest(req);
  if (order.userId && (!user || user.id !== order.userId)) {
    return res.status(403).json({ code: 403, message: '无权查看这笔订单' });
  }

  res.json({ code: 0, message: 'ok', data: order });
});

/**
 * GET /api/orders
 * ------------------------------------------------------------
 * 只返回当前登录用户的订单。
 * 未登录时返回 401，不再支持"按订单号批量查"的游客模式 ——
 * 既然下单必须登录，就不存在游客订单了。
 */
router.get('/orders', function (req, res) {
  const user = auth.getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({
      code: 401,
      message: '请先登录后查看订单'
    });
  }

  res.json({
    code: 0,
    message: 'ok',
    data: store.listOrdersByUser(user.id)
  });
});

module.exports = router;
