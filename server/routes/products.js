/**
 * 商品相关接口
 * ------------------------------------------------------------
 * GET /api/products          商品列表（支持搜索/筛选/排序/分页）
 * GET /api/products/:id      商品详情
 * GET /api/categories        分类列表
 *
 * 统一的返回格式（很重要，前端才好处理）：
 *   成功：{ code: 0, message: 'ok', data: ... }
 *   失败：{ code: 非0, message: '错误说明' }
 */

const express = require('express');
const store = require('../store');

const router = express.Router();

/**
 * GET /api/products
 * 查询参数：
 *   keyword   关键词，搜商品名/简介/标签/品牌
 *   category  分类 id
 *   minPrice  最低价
 *   maxPrice  最高价
 *   sort      price_asc | price_desc | rating | default
 *   page      第几页，从 1 开始
 *   pageSize  每页几条，默认 12
 */
router.get('/products', function (req, res) {
  const result = store.findProducts(req.query);
  res.json({ code: 0, message: 'ok', data: result });
});

/**
 * GET /api/products/:id
 */
router.get('/products/:id', function (req, res) {
  const product = store.findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ code: 404, message: '商品不存在' });
  }
  res.json({ code: 0, message: 'ok', data: product });
});

/**
 * GET /api/categories
 * 顺便带上每个分类下有多少个商品，前端做分类入口时可以显示数量。
 */
router.get('/categories', function (req, res) {
  const list = store.categories.map(function (c) {
    const count = store.products.filter(function (p) { return p.category === c.id; }).length;
    return { id: c.id, name: c.name, icon: c.icon, count: count };
  });
  res.json({ code: 0, message: 'ok', data: list });
});

module.exports = router;
