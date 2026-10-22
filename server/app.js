/**
 * 云巢商城 - 后端服务入口
 * ------------------------------------------------------------
 * 启动方式：npm start      （或者 npm run dev，改代码自动重启）
 * 启动后访问：http://localhost:3000
 *
 * 这个文件只做三件事：
 *   1. 创建 express 应用
 *   2. 挂上中间件（解析 JSON、打印请求日志）
 *   3. 把前端静态页面和 API 路由接上去
 */

const path = require('path');
const express = require('express');

const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');
const supportRouter = require('./routes/support');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- 中间件 ---------- */

// 让 req.body 能自动解析前端发来的 JSON
app.use(express.json());

// 简单的请求日志，方便调试时看到前端到底请求了什么
app.use(function (req, res, next) {
  const start = Date.now();
  res.on('finish', function () {
    console.log(
      req.method + ' ' + req.originalUrl + ' -> ' + res.statusCode + ' (' + (Date.now() - start) + 'ms)'
    );
  });
  next();
});

/* ---------- API 路由 ---------- */

app.use('/api', productsRouter);
app.use('/api', authRouter);
app.use('/api', ordersRouter);
app.use('/api', supportRouter);

// 健康检查：用来确认服务活着
app.get('/api/health', function (req, res) {
  res.json({ code: 0, message: 'ok', data: { service: 'cloudnest-shop', time: new Date().toISOString() } });
});

/* ---------- 静态资源（前端页面） ---------- */

// web 目录就是网站根目录。访问 http://localhost:3000/ 会自动返回 web/index.html
app.use(express.static(path.join(__dirname, '..', 'web')));

/* ---------- 兜底 ---------- */

// 没匹配到的 /api 请求，返回规范的 JSON 错误，而不是一坨 HTML
app.use('/api', function (req, res) {
  res.status(404).json({ code: 404, message: '接口不存在: ' + req.originalUrl });
});

// 全局错误处理：任何一个路由抛异常，都会走到这里
app.use(function (err, req, res, next) {
  console.error('[服务器错误]', err);
  res.status(500).json({ code: 500, message: '服务器内部错误：' + err.message });
});

/* ---------- 启动 ---------- */

// 线上环境（SEED_DEMO_USER=1）首次启动时建一个演示账号。
// 因为免费云平台的磁盘是临时的，重启后数据会清空，
// 有这个机制才能保证在线 Demo 永远有账号可以登录。
// 本地开发不设这个变量，所以不会凭空多出一个账号。
auth.ensureDemoUser();

app.listen(PORT, function () {
  console.log('');
  console.log('  云巢商城 CloudNest 已启动');
  console.log('  ------------------------------------');
  console.log('  商城首页:  http://localhost:' + PORT + '/');
  console.log('  商品接口:  http://localhost:' + PORT + '/api/products');
  console.log('  健康检查:  http://localhost:' + PORT + '/api/health');

  // 部署到云平台时，PUBLIC_URL 由平台提供，方便直接点开
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log('  线上地址:  ' + process.env.RENDER_EXTERNAL_URL);
  }

  console.log('  ------------------------------------');
  console.log('  按 Ctrl + C 停止服务');
  console.log('');
});
