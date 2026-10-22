/**
 * 用户与会话（登录状态）管理
 * ------------------------------------------------------------
 * 这个文件只负责一件事：用户数据怎么存、怎么验证、怎么记住"谁登录了"。
 * HTTP 接口怎么收请求，交给 routes/auth.js，两边分开，互不干扰。
 *
 * 数据存在 server/data/users.json，结构：
 * {
 *   "users": [
 *     { id, username, nickname, passwordHash, salt, createdAt }
 *   ],
 *   "sessions": [
 *     { token, userId, createdAt, expiresAt }
 *   ]
 * }
 *
 * 【关于密码安全，有三条必须守住的底线】
 *
 * 1. 密码绝对不能明文存。
 *    数据库一旦泄露，明文密码等于把所有用户的账号送人。
 *    这里用 scrypt 算法做"单向加密"（哈希）：
 *    加密之后没法反推回原密码，登录时是"把你输入的密码再算一次，
 *    看结果和存的是不是一样"。
 *
 * 2. 必须加盐（salt）。
 *    同样的密码 123456，不加盐算出来的哈希永远一样，
 *    坏人可以预先算好一张"常用密码 → 哈希"的表来查（彩虹表攻击）。
 *    每个用户配一个随机的盐一起加密，同样的密码结果就完全不同了。
 *
 * 3. 接口里绝不能把 passwordHash 和 salt 返回给前端。
 *    用 publicUser() 过滤一遍再返回。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// 登录有效期：7 天
const SESSION_DAYS = 7;

// scrypt 的强度参数。数值越大越安全，但也越慢。
// 64 是 Node 的默认值，配合 32 字节的密钥长度，安全性足够。
const SCRYPT_KEYLEN = 32;

/* ============================================================
   一、文件读写
   ============================================================ */

/**
 * 读取整个数据文件。文件不存在或内容坏了就返回空结构。
 */
function readDb() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const db = JSON.parse(raw);

    return {
      users: Array.isArray(db.users) ? db.users : [],
      sessions: Array.isArray(db.sessions) ? db.sessions : []
    };
  } catch (err) {
    return { users: [], sessions: [] };
  }
}

/**
 * 写回文件。
 */
function writeDb(db) {
  // data 目录可能不存在（比如刚 clone 下来的项目），先确保它在
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2), 'utf8');
}

/* ============================================================
   二、密码加密
   ============================================================ */

/**
 * 给密码加密，返回 { hash, salt }。
 *
 * 用 Node 自带的 crypto.scryptSync，不需要装第三方库。
 * scrypt 是专门为"抗暴力破解"设计的算法：它故意很慢、很吃内存，
 * 正常人登录一次感觉不到，但想每秒试几百万次密码就不行了。
 */
function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, useSalt, SCRYPT_KEYLEN).toString('hex');
  return { hash, salt: useSalt };
}

/**
 * 校验密码是否正确。
 *
 * 【为什么要用 timingSafeEqual 而不是 === ？】
 * 普通的 === 比较是"发现不同立刻返回"，比得越久说明前面对上的字符越多。
 * 攻击者可以通过测量响应时间一点点猜出密码（时序攻击）。
 * timingSafeEqual 不管内容如何，耗时都一样，不会泄露信息。
 */
function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(expectedHash, 'hex');

    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (err) {
    return false;
  }
}

/* ============================================================
   三、对外返回的用户信息
   ============================================================ */

/**
 * 把内部用户对象转成可以安全返回给前端的样子。
 * 关键：去掉 passwordHash 和 salt。
 */
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    createdAt: user.createdAt
  };
}

/* ============================================================
   四、查找
   ============================================================ */

function findUserByName(username) {
  const db = readDb();
  const target = String(username || '').trim().toLowerCase();
  return db.users.find(function (u) {
    return u.username.toLowerCase() === target;
  }) || null;
}

function findUserById(id) {
  const db = readDb();
  return db.users.find(function (u) { return u.id === id; }) || null;
}

/* ============================================================
   五、从请求里取出登录凭证
   ------------------------------------------------------------
   登录成功后后端返回一个 token，前端每次请求放在请求头里：
       Authorization: Bearer <token>

   为什么放请求头而不是 URL 参数？
   因为 URL 会被记录到浏览器历史、服务器访问日志、代理日志里，
   放请求头里相对安全。

   这个函数放在 auth.js 而不是路由文件里，
   是因为订单接口也需要它（判断是谁在下单），
   两处共用的逻辑就应该只有一份。
   ============================================================ */

function getTokenFromRequest(req) {
  const header = (req && req.headers && req.headers.authorization) || '';

  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return header.trim() || '';
}

/**
 * 从请求里直接拿到当前登录用户，没登录返回 null。
 * 路由里用这一句就够，不用自己拼 token 和查询。
 */
function getUserFromRequest(req) {
  return getUserByToken(getTokenFromRequest(req));
}

/* ============================================================
   六、注册
   ============================================================ */

/**
 * 注册新用户。
 * @param {{username, password, nickname}} input
 * @returns {{ok:true, user}|{ok:false, message}}
 */
function registerUser(input) {
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  const nickname = String(input.nickname || '').trim() || username;

  /* ---- 参数校验 ----
     前端已经校验过一遍，这里必须再查一遍。
     因为前端校验只是"帮用户少犯错"，绕过前端太容易了
     （随便用个工具就能直接调接口），所以后端才是最后一道关。 */

  if (!username) {
    return { ok: false, message: '请填写用户名' };
  }

  // 用户名规则：3~20 位，字母数字下划线
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { ok: false, message: '用户名需要 3~20 位，只能包含字母、数字、下划线' };
  }

  if (password.length < 6) {
    return { ok: false, message: '密码至少 6 位' };
  }
  if (password.length > 64) {
    return { ok: false, message: '密码不能超过 64 位' };
  }

  if (nickname.length > 20) {
    return { ok: false, message: '昵称不能超过 20 个字' };
  }

  if (findUserByName(username)) {
    return { ok: false, message: '这个用户名已经被注册了' };
  }

  /* ---- 写入 ---- */
  const db = readDb();
  const { hash, salt } = hashPassword(password);

  const user = {
    id: db.users.length > 0
      ? Math.max.apply(null, db.users.map(function (u) { return u.id; })) + 1
      : 1,
    username: username,
    nickname: nickname,
    passwordHash: hash,
    salt: salt,
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  writeDb(db);

  return { ok: true, user: publicUser(user) };
}

/* ============================================================
   七、登录 / 退出 / 会话
   ============================================================ */

/**
 * 生成一个登录凭证（token）。
 *
 * 为什么不用"用户名 + 密码"在每个请求里传来传去？
 * 那样每次请求都要重新验证密码，很慢，而且密码在网络上来回传风险大。
 * 正确做法是：登录成功后发一个随机字符串当"临时通行证"，
 * 之后前端每次请求带上它，后端查一下这个字符串对应哪个用户就行。
 *
 * token 用 crypto.randomBytes(32) 生成，是 64 位十六进制字符串。
 * 要猜中的概率低到可以忽略。
 */
function createSession(userId) {
  const db = readDb();

  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.sessions.push({
    token: token,
    userId: userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: expiresAt
  });

  // 顺便清理掉已经过期的会话，避免文件越堆越大
  db.sessions = db.sessions.filter(function (s) {
    return new Date(s.expiresAt).getTime() > now;
  });

  writeDb(db);
  return token;
}

/**
 * 登录。
 * @returns {{ok:true, token, user}|{ok:false, message}}
 */
function loginUser(input) {
  const username = String(input.username || '').trim();
  const password = String(input.password || '');

  if (!username || !password) {
    return { ok: false, message: '请填写用户名和密码' };
  }

  const user = findUserByName(username);

  /* 【注意这里故意不区分"用户不存在"和"密码错误"】
     如果分开提示，别人就能拿这个接口来试探哪些用户名注册过
     （所谓用户名枚举）。统一说"用户名或密码不正确"更安全。
     同样，用户不存在时也要走一遍密码校验，让耗时保持一致。 */
  if (!user) {
    verifyPassword(password, 'dummy-salt', '00'.repeat(SCRYPT_KEYLEN));
    return { ok: false, message: '用户名或密码不正确' };
  }

  if (!verifyPassword(password, user.salt, user.passwordHash)) {
    return { ok: false, message: '用户名或密码不正确' };
  }

  const token = createSession(user.id);
  return { ok: true, token: token, user: publicUser(user) };
}

/**
 * 退出登录：把这个 token 从会话列表里删掉。
 * 删掉之后这个 token 就失效了，即使有人捡到也没用。
 */
function logoutUser(token) {
  if (!token) return { ok: true };

  const db = readDb();
  const before = db.sessions.length;

  db.sessions = db.sessions.filter(function (s) { return s.token !== token; });

  if (db.sessions.length !== before) {
    writeDb(db);
  }
  return { ok: true };
}

/**
 * 根据 token 找到对应的用户。token 无效或过期都返回 null。
 */
function getUserByToken(token) {
  if (!token) return null;

  const db = readDb();
  const now = Date.now();

  const session = db.sessions.find(function (s) {
    return s.token === token && new Date(s.expiresAt).getTime() > now;
  });

  if (!session) return null;

  const user = db.users.find(function (u) { return u.id === session.userId; });
  return user || null;
}

/* ============================================================
   八、导出
   ============================================================ */

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserByToken,
  getTokenFromRequest,
  getUserFromRequest,
  publicUser
};
