/**
 * 建一个演示账号（用 Node 发请求，保证中文编码正确）
 * 用 PowerShell 的 Invoke-RestMethod 传中文会因为编码问题变成 ????，
 * 所以这里用 Node 的 fetch，它默认就是 UTF-8。
 *
 * 运行：node tools/make-demo-user.js
 * 输出：token（给截图脚本用）
 */
const SERVER = 'http://localhost:3000';

async function main() {
  const stamp = String(Date.now()).slice(-6);
  const username = 'demo_' + stamp;
  const password = 'demo123456';
  const nickname = '演示用户';

  const res = await fetch(SERVER + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, nickname })
  });

  const json = await res.json();

  if (json.code !== 0) {
    console.error('注册失败:', json.message);
    process.exit(1);
  }

  // 顺便下两单，这样订单页有内容可看
  for (const pid of [1, 7]) {
    const orderRes = await fetch(SERVER + '/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + json.data.token
      },
      body: JSON.stringify({
        items: [{ productId: pid, quantity: 1 }],
        customer: {
          name: '演示用户',
          phone: '13800138000',
          address: '浙江省杭州市西湖区文三路 100 号'
        },
        remark: pid === 1 ? '麻烦工作日送' : ''
      })
    });
    const orderJson = await orderRes.json();
    if (orderJson.code === 0) {
      console.log('  已创建订单', orderJson.data.id);
    }
  }

  console.log('TOKEN=' + json.data.token);
  console.log('USERNAME=' + json.data.user.username);
  console.log('NICKNAME=' + json.data.user.nickname);
}

main().catch((e) => { console.error(e); process.exit(1); });
