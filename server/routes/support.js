/**
 * 客服相关接口
 * ------------------------------------------------------------
 * GET /api/support/faq          常见问题列表（公开，不需要登录）
 * GET /api/support/my-orders    我最近几笔订单的简要信息（需要登录）
 *
 * 【为什么客服要走接口，不直接写在前端？】
 * 1. 知识库（运费、退换货、保修这些）是运营资料，会经常调整，
 *    放在后端改完就生效，不用重新发前端。
 * 2. 订单相关的问题必须查真实数据，而且要校验登录身份 ——
 *    这些只能在服务端做，放前端等于把别人的订单暴露出去。
 *
 * 【为什么单独一个路由文件？】
 * 客服是独立功能。虽然它和商品、订单都有关系，
 * 但它自己的"知识"和"话术"不该混进商品或订单接口里。
 * 现在这样也方便以后单独替换（比如换成接大模型或知识库检索）。
 */

const express = require('express');
const { knowledgeBase } = require('../knowledge');
const store = require('../store');
const auth = require('../auth');

const router = express.Router();

/* ============================================================
   GET /api/support/faq
   ------------------------------------------------------------
   返回全部常见问题。
   前端拿去做两件事：显示"猜你想问"快捷问题，以及本地匹配回答。
   ============================================================ */

router.get('/support/faq', function (req, res) {
  // 为了响应更小，只返回前端要用的字段
  const list = knowledgeBase.map(function (item) {
    return {
      id: item.id,
      title: item.title,
      keywords: item.keywords,
      answer: item.answer,
      related: item.related || []
    };
  });

  res.json({ code: 0, message: 'ok', data: list });
});

/* ============================================================
   GET /api/support/my-orders
   ------------------------------------------------------------
   给客服用的"我的最近订单"。
   和 /api/orders 的区别：只返回最近 5 笔，并且只带客服回答需要的字段
   （订单号、状态、金额、时间、商品名），不带收货地址等隐私细节。

   需要登录。未登录返回 401，前端提示"请先登录再查订单"。
   ============================================================ */

router.get('/support/my-orders', function (req, res) {
  const user = auth.getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({
      code: 401,
      message: '请先登录后再查询订单'
    });
  }

  const orders = store.listOrdersByUser(user.id).slice(0, 5);

  const list = orders.map(function (o) {
    return {
      id: o.id,
      status: o.status,
      statusText: o.statusText,
      totalPrice: o.totalPrice,
      itemCount: o.itemCount,
      createdAt: o.createdAt,
      // 只带商品名和数量，够回答问题就行
      items: o.items.map(function (it) {
        return { name: it.name, quantity: it.quantity, price: it.price };
      })
    };
  });

  res.json({ code: 0, message: 'ok', data: list });
});

module.exports = router;
