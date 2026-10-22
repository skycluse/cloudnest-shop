/**
 * 订单相关接口
 * ------------------------------------------------------------
 * POST /api/orders        创建订单（登录与否都可以下单）
 * GET  /api/orders/:id    查询单笔订单
 * GET  /api/orders        查询订单列表
 *
 * 【为什么不登录也能下单？】
 * 商城的基本流程不能因为"要登录"就被挡住 ——
 * 一个只是想试试的人，应该能直接加购物车、直接下单，不用先注册。
 * 所以这里保留游客下单，只是给登录用户的订单记上 userId，
 * 这样登录之后就能看到「我的订单」。
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
  // 带了有效登录凭证就记到这个用户名下，
  // 没登录也不拦着，userId 为 null，属于游客订单
  const user = auth.getUserFromRequest(req);

  const payload = Object.assign({}, req.body);
  payload.userId = user ? user.id : null;

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
 */
router.get('/orders/:id', function (req, res) {
  const order = store.findOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ code: 404, message: '订单不存在' });
  }
  res.json({ code: 0, message: 'ok', data: order });
});

/**
 * GET /api/orders
 * ------------------------------------------------------------
 * 三种情况：
 *
 * 1. 已登录            → 返回这个账号的所有订单
 * 2. 未登录 + 带 ids   → 按订单号返回（本机下过的单）
 *                        例：?ids=CN2026xxx-123,CN2026xxx-456
 * 3. 未登录 + 没带 ids → 返回空数组
 *
 * 第 3 种返回空，而不是返回全部 ——
 * 订单里有收货人姓名、电话、地址，属于隐私，
 * 不能因为没登录就把所有人的订单都吐出来。
 */
router.get('/orders', function (req, res) {
  const user = auth.getUserFromRequest(req);

  // 情况 1：已登录，看自己的订单
  if (user) {
    return res.json({
      code: 0,
      message: 'ok',
      data: store.listOrdersByUser(user.id)
    });
  }

  // 情况 2：未登录，但前端传了本机的订单号
  const idsParam = req.query.ids;
  if (idsParam) {
    const ids = String(idsParam)
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    return res.json({
      code: 0,
      message: 'ok',
      data: store.listOrdersByIds(ids)
    });
  }

  // 情况 3：什么都没有，返回空
  res.json({ code: 0, message: 'ok', data: [] });
});

module.exports = router;
