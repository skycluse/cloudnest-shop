/**
 * 订单相关接口
 * ------------------------------------------------------------
 * POST /api/orders        创建订单（模拟支付）
 * GET  /api/orders/:id    查询订单详情
 * GET  /api/orders        查询订单列表（调试用）
 */

const express = require('express');
const store = require('../store');

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
  const result = store.createOrder(req.body);

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
 */
router.get('/orders', function (req, res) {
  res.json({ code: 0, message: 'ok', data: store.listOrders() });
});

module.exports = router;
