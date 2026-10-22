/**
 * 用户相关接口
 * ------------------------------------------------------------
 * POST /api/auth/register   注册
 * POST /api/auth/login      登录
 * POST /api/auth/logout     退出
 * GET  /api/auth/me         获取当前登录用户
 *
 * 这里的代码只负责"收请求、调函数、回响应"，
 * 用户怎么存、密码怎么验、token 怎么生成，全在 auth.js 里。
 * 这样职责清楚，出问题时也知道该看哪个文件。
 */

const express = require('express');
const auth = require('../auth');

const router = express.Router();

/* ============================================================
   注册
   ------------------------------------------------------------
   注册成功直接返回 token 并帮用户登录，
   省得他刚注册完还要再输一遍密码。
   ============================================================ */

router.post('/auth/register', function (req, res) {
  const result = auth.registerUser(req.body || {});

  if (!result.ok) {
    return res.status(400).json({ code: 400, message: result.message });
  }

  const login = auth.loginUser({
    username: req.body.username,
    password: req.body.password
  });

  res.status(201).json({
    code: 0,
    message: '注册成功',
    data: {
      token: login.ok ? login.token : '',
      user: result.user
    }
  });
});

/* ============================================================
   登录
   ============================================================ */

router.post('/auth/login', function (req, res) {
  const result = auth.loginUser(req.body || {});

  if (!result.ok) {
    return res.status(400).json({ code: 400, message: result.message });
  }

  res.json({
    code: 0,
    message: '登录成功',
    data: { token: result.token, user: result.user }
  });
});

/* ============================================================
   退出
   ============================================================ */

router.post('/auth/logout', function (req, res) {
  auth.logoutUser(auth.getTokenFromRequest(req));
  res.json({ code: 0, message: '已退出登录' });
});

/* ============================================================
   获取当前用户
   ------------------------------------------------------------
   页面刷新后前端用这个接口确认"我还登录着吗"，
   顺便拿到最新的用户信息。
   ============================================================ */

router.get('/auth/me', function (req, res) {
  const user = auth.getUserFromRequest(req);

  if (!user) {
    // 没登录不算错误。返回 401 让前端知道该显示"登录"按钮了。
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  res.json({ code: 0, message: 'ok', data: auth.publicUser(user) });
});

module.exports = router;
