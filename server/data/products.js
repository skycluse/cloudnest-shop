/**
 * 商品种子数据（种子 = seed，就是"初始造好的数据"）
 * ------------------------------------------------------------
 * 考核要求：15~30 个商品，彼此有差异，不能硬编码在前端。
 * 这里放 24 个商品，6 个分类，方便后面做「筛选」和「AI 同品牌组合」。
 *
 * 字段说明：
 *   id        商品唯一编号
 *   name      商品名称
 *   brand     品牌（AI Agent 做"同一品牌组合购买"时会用到）
 *   category  分类 id，对应 categories 里的 id
 *   price     价格（单位：元）
 *   stock     库存（0 表示售罄）
 *   image     图片路径
 *   tagline   一句话简介
 *   tags      标签数组（搜索关键词、AI 推荐理由会用到）
 *   desc      详细介绍
 *   specs     规格参数对象
 *   rating    评分 0~5
 */

const categories = [
  { id: 'audio', name: '耳机音频', icon: '🎧' },
  { id: 'keyboard', name: '键盘外设', icon: '⌨️' },
  { id: 'mouse', name: '鼠标', icon: '🖱️' },
  { id: 'power', name: '充电储能', icon: '🔋' },
  { id: 'smart', name: '智能家居', icon: '💡' },
  { id: 'accessory', name: '配件周边', icon: '🧩' }
];

const products = [
  // ============ 耳机音频 ============
  {
    id: 1,
    name: '云巢 AirPods Lite 运动蓝牙耳机',
    brand: '云巢',
    category: 'audio',
    price: 299,
    stock: 42,
    image: '/assets/products/earphone-1.svg',
    tagline: '跑步不掉，IPX5 防水，续航 8 小时',
    tags: ['运动', '蓝牙', '耳机', '防水', '无线', '跑步'],
    desc: '专为运动场景设计的入耳式蓝牙耳机。采用三点式硅胶耳翼结构，剧烈运动也不易脱落；IPX5 级防水可抵御汗水与小雨；单次充电续航 8 小时，配合充电盒可达 32 小时。',
    specs: { 蓝牙版本: '5.3', 续航: '8h（单次）/ 32h（含仓）', 防水等级: 'IPX5', 重量: '4.5g（单只）' },
    rating: 4.6
  },
  {
    id: 2,
    name: '云巢 Studio Pro 头戴式降噪耳机',
    brand: '云巢',
    category: 'audio',
    price: 899,
    stock: 18,
    image: '/assets/products/earphone-2.svg',
    tagline: '主动降噪 42dB，佩戴舒适，办公通勤首选',
    tags: ['降噪', '头戴', '耳机', '通勤', '办公', '无线'],
    desc: '搭载双馈式主动降噪系统，最高可降低 42dB 环境噪声。40mm 动圈单元带来宽阔声场，耳罩采用蛋白皮记忆棉，长时间佩戴不夹头。',
    specs: { 蓝牙版本: '5.3', 降噪深度: '42dB', 续航: '40h', 单元: '40mm 动圈' },
    rating: 4.8
  },
  {
    id: 3,
    name: '云巢 Buds Go 真无线耳机',
    brand: '云巢',
    category: 'audio',
    price: 149,
    stock: 120,
    image: '/assets/products/earphone-3.svg',
    tagline: '百元价位，日常听歌够用',
    tags: ['入门', '蓝牙', '耳机', '无线', '便宜'],
    desc: '入门级真无线耳机，主打轻便和长续航。半入耳设计佩戴无压迫感，触控操作，开盖即连。',
    specs: { 蓝牙版本: '5.2', 续航: '6h（单次）/ 24h（含仓）', 防水等级: 'IPX4', 重量: '3.8g（单只）' },
    rating: 4.2
  },
  {
    id: 4,
    name: '声阔 SpaceOne 运动降噪耳机',
    brand: '声阔',
    category: 'audio',
    price: 549,
    stock: 0,
    image: '/assets/products/earphone-4.svg',
    tagline: '运动与降噪兼顾，可折叠收纳',
    tags: ['运动', '降噪', '耳机', '头戴', '蓝牙'],
    desc: '把主动降噪塞进轻量化运动头戴。整机 265g，支持折叠收纳；降噪深度 35dB，运动时也能保持专注。',
    specs: { 蓝牙版本: '5.3', 降噪深度: '35dB', 续航: '55h', 重量: '265g' },
    rating: 4.5
  },
  {
    id: 5,
    name: '声阔 Liberty Air 通勤降噪耳机',
    brand: '声阔',
    category: 'audio',
    price: 429,
    stock: 33,
    image: '/assets/products/earphone-5.svg',
    tagline: '地铁通勤神器，通话清晰',
    tags: ['降噪', '通勤', '耳机', '蓝牙', '通话'],
    desc: '六麦克风通话降噪，地铁、公交等嘈杂环境下对方也能听清。支持通透模式，不错过报站。',
    specs: { 蓝牙版本: '5.3', 降噪深度: '30dB', 续航: '9h（单次）/ 36h（含仓）', 麦克风: '6 麦克风' },
    rating: 4.4
  },
  {
    id: 6,
    name: '聆音 K1 有线入耳式耳机',
    brand: '聆音',
    category: 'audio',
    price: 89,
    stock: 200,
    image: '/assets/products/earphone-6.svg',
    tagline: '3.5mm 有线，零延迟，游戏党友好',
    tags: ['有线', '耳机', '入门', '游戏', '便宜'],
    desc: '没有蓝牙延迟的烦恼。3.5mm 通用接口，带线控麦克风，插上就能用，适合游戏和网课。',
    specs: { 接口: '3.5mm', 线长: '1.2m', 阻抗: '32Ω', 灵敏度: '98dB' },
    rating: 4.0
  },

  // ============ 键盘外设 ============
  {
    id: 7,
    name: '云巢 K87 三模机械键盘',
    brand: '云巢',
    category: 'keyboard',
    price: 399,
    stock: 56,
    image: '/assets/products/keyboard-1.svg',
    tagline: '有线/蓝牙/2.4G 三模，Gasket 结构',
    tags: ['机械键盘', '三模', '键盘', 'Gasket', '热插拔', '办公'],
    desc: '87 键紧凑布局，Gasket 结构带来柔和一致的手感；支持热插拔轴座，换轴无需焊接；三模连接最多可记忆 3 台设备。',
    specs: { 配列: '87 键', 连接: '有线 / 蓝牙 / 2.4G', 结构: 'Gasket', 电池: '4000mAh' },
    rating: 4.7
  },
  {
    id: 8,
    name: '云巢 K68 便携机械键盘',
    brand: '云巢',
    category: 'keyboard',
    price: 259,
    stock: 74,
    image: '/assets/products/keyboard-2.svg',
    tagline: '68 键小配列，桌面省地方',
    tags: ['机械键盘', '键盘', '小配列', '便携', '入门'],
    desc: '68 键极简配列，保留方向键与常用功能区，比 87 键再省 20% 桌面空间。适合小桌面和随身携带。',
    specs: { 配列: '68 键', 连接: '有线 / 蓝牙', 轴体: '红轴', 电池: '2000mAh' },
    rating: 4.5
  },
  {
    id: 9,
    name: '云巢 K108 全尺寸机械键盘',
    brand: '云巢',
    category: 'keyboard',
    price: 499,
    stock: 21,
    image: '/assets/products/keyboard-3.svg',
    tagline: '带数字小键盘，财务办公够用',
    tags: ['机械键盘', '键盘', '全尺寸', '数字键盘', '办公'],
    desc: '108 键全尺寸布局，带独立数字小键盘。PBT 二色成型键帽，长期使用不打油；支持全键无冲。',
    specs: { 配列: '108 键', 连接: '有线', 键帽: 'PBT 二色', 无冲: '全键无冲' },
    rating: 4.6
  },
  {
    id: 10,
    name: '声阔 MK75 客制化机械键盘',
    brand: '声阔',
    category: 'keyboard',
    price: 899,
    stock: 12,
    image: '/assets/products/keyboard-4.svg',
    tagline: '铝合金外壳，客制化玩家的选择',
    tags: ['机械键盘', '客制化', '键盘', '铝坨坨', '高端'],
    desc: 'CNC 铝合金一体外壳，重达 1.4kg 稳如磐石。支持 QMK 固件自定义改键，配三模连接。',
    specs: { 配列: '75 键', 外壳: 'CNC 铝合金', 连接: '有线 / 蓝牙 / 2.4G', 重量: '1.4kg' },
    rating: 4.9
  },
  {
    id: 11,
    name: '声阔 MK60 静音机械键盘',
    brand: '声阔',
    category: 'keyboard',
    price: 349,
    stock: 40,
    image: '/assets/products/keyboard-5.svg',
    tagline: '静音轴体，宿舍/图书馆友好',
    tags: ['机械键盘', '静音', '键盘', '宿舍', '办公'],
    desc: '搭载静音红轴，触底加装消音硅胶，噪音比普通红轴低约 40%，深夜敲代码不吵室友。',
    specs: { 配列: '61 键', 轴体: '静音红轴', 连接: '有线 / 蓝牙', 电池: '3000mAh' },
    rating: 4.4
  },
  {
    id: 12,
    name: '聆音 Slim 薄膜办公键盘',
    brand: '聆音',
    category: 'keyboard',
    price: 129,
    stock: 150,
    image: '/assets/products/keyboard-6.svg',
    tagline: '超薄静音，百元内办公选择',
    tags: ['薄膜键盘', '键盘', '便宜', '入门', '办公', '超薄'],
    desc: '剪刀脚结构，键程 2mm，打字轻盈安静。巧克力键帽，机身厚度仅 12mm，便于收纳。',
    specs: { 配列: '104 键', 类型: '薄膜', 厚度: '12mm', 连接: 'USB 有线' },
    rating: 3.9
  },

  // ============ 鼠标 ============
  {
    id: 13,
    name: '云巢 M3 无线静音鼠标',
    brand: '云巢',
    category: 'mouse',
    price: 99,
    stock: 180,
    image: '/assets/products/mouse-1.svg',
    tagline: '静音按键，办公不打扰同事',
    tags: ['鼠标', '无线', '静音', '办公', '便宜'],
    desc: '左右键静音微动，点击声降低 60%。1200/1600/2000 三档 DPI 一键切换，一节 5 号电池可用 12 个月。',
    specs: { 连接: '2.4G 无线', DPI: '1200/1600/2000', 按键: '静音', 续航: '12 个月' },
    rating: 4.3
  },
  {
    id: 14,
    name: '云巢 M7 Pro 无线电竞鼠标',
    brand: '云巢',
    category: 'mouse',
    price: 299,
    stock: 45,
    image: '/assets/products/mouse-2.svg',
    tagline: '26000 DPI，58g 轻量化',
    tags: ['鼠标', '电竞', '无线', '轻量化', '游戏'],
    desc: 'PAW3395 旗舰传感器，26000 DPI，650 IPS。58g 超轻机身，1000Hz 回报率，延迟低至 1ms。',
    specs: { 连接: '2.4G / 有线', 传感器: 'PAW3395', DPI: '26000', 重量: '58g' },
    rating: 4.8
  },
  {
    id: 15,
    name: '声阔 G5 有线游戏鼠标',
    brand: '声阔',
    category: 'mouse',
    price: 169,
    stock: 63,
    image: '/assets/products/mouse-3.svg',
    tagline: 'RGB 灯效，6 键可编程',
    tags: ['鼠标', '游戏', '有线', 'RGB', '入门'],
    desc: '6 个可编程按键，配合驱动可录制宏；RGB 灯效支持 1680 万色自定义，游戏氛围拉满。',
    specs: { 连接: 'USB 有线', DPI: '12800', 按键: '6 键可编程', 灯效: 'RGB' },
    rating: 4.2
  },

  // ============ 充电储能 ============
  {
    id: 16,
    name: '云巢 PowerGo 20000mAh 充电宝',
    brand: '云巢',
    category: 'power',
    price: 169,
    stock: 88,
    image: '/assets/products/power-1.svg',
    tagline: '22.5W 快充，可上飞机',
    tags: ['充电宝', '移动电源', '快充', '配件', '旅行'],
    desc: '20000mAh 大容量，22.5W 双向快充，30 分钟给手机充到 60%。通过民航安检认证，可随身登机。',
    specs: { 容量: '20000mAh', 功率: '22.5W', 接口: 'USB-A ×2 / Type-C ×1', 重量: '380g' },
    rating: 4.5
  },
  {
    id: 17,
    name: '云巢 GaN 65W 氮化镓充电器',
    brand: '云巢',
    category: 'power',
    price: 129,
    stock: 110,
    image: '/assets/products/power-2.svg',
    tagline: '一个头搞定手机+平板+笔记本',
    tags: ['充电器', '氮化镓', '快充', '配件', 'GaN'],
    desc: '氮化镓技术让 65W 充电器只有乒乓球大小。双 C 口 + 单 A 口，可同时给三台设备供电。',
    specs: { 功率: '65W', 接口: 'Type-C ×2 / USB-A ×1', 技术: 'GaN 氮化镓', 重量: '112g' },
    rating: 4.7
  },
  {
    id: 18,
    name: '聆音 磁吸无线充电宝',
    brand: '聆音',
    category: 'power',
    price: 199,
    stock: 0,
    image: '/assets/products/power-3.svg',
    tagline: '磁吸即充，出门不用带线',
    tags: ['充电宝', '磁吸', '无线充', '配件', 'MagSafe'],
    desc: '磁吸贴合手机背面，15W 无线快充。10000mAh 容量，厚度仅 12mm，边充边玩不挡手。',
    specs: { 容量: '10000mAh', 无线功率: '15W', 厚度: '12mm', 磁吸: '支持' },
    rating: 4.4
  },

  // ============ 智能家居 ============
  {
    id: 19,
    name: '云巢 智能护眼台灯 Pro',
    brand: '云巢',
    category: 'smart',
    price: 359,
    stock: 37,
    image: '/assets/products/smart-1.svg',
    tagline: '国AA级照度，自动调光不伤眼',
    tags: ['台灯', '护眼', '智能家居', '学习', '办公'],
    desc: '国 AA 级照度标准，无可视频闪。内置光传感器，根据环境光自动调节亮度，久看不累。支持 App 控制色温。',
    specs: { 照度: '国 AA 级', 色温: '2700K~6500K', 显色指数: 'Ra95', 控制: '触控 / App' },
    rating: 4.6
  },
  {
    id: 20,
    name: '云巢 智能插座 WiFi 版',
    brand: '云巢',
    category: 'smart',
    price: 49,
    stock: 240,
    image: '/assets/products/smart-2.svg',
    tagline: '远程开关，定时断电',
    tags: ['插座', '智能家居', 'WiFi', '便宜', '配件'],
    desc: '手机远程控制家电开关，支持定时与倒计时任务。自带电量统计，能看清哪个电器最费电。',
    specs: { 连接: 'WiFi 2.4G', 额定: '10A / 2500W', 功能: '远程 / 定时 / 电量统计', 尺寸: '52×52mm' },
    rating: 4.3
  },
  {
    id: 21,
    name: '声阔 智能音箱 mini',
    brand: '声阔',
    category: 'smart',
    price: 249,
    stock: 51,
    image: '/assets/products/smart-3.svg',
    tagline: '语音助手入口，能控家电',
    tags: ['音箱', '智能家居', '语音', '蓝牙'],
    desc: '内置语音助手，可语音控制同品牌智能设备。5W 全频扬声器，音质在小体积里算出色。',
    specs: { 功率: '5W', 连接: 'WiFi / 蓝牙 5.0', 语音: '支持', 尺寸: '95×95×90mm' },
    rating: 4.1
  },

  // ============ 配件周边 ============
  {
    id: 22,
    name: '云巢 桌面理线器套装',
    brand: '云巢',
    category: 'accessory',
    price: 39,
    stock: 300,
    image: '/assets/products/acc-1.svg',
    tagline: '告别桌面蜘蛛网',
    tags: ['理线', '配件', '桌面', '便宜', '收纳'],
    desc: '含硅胶理线夹 6 个、魔术贴扎带 10 条、桌面走线槽 2 米。把乱糟糟的线材一次收干净。',
    specs: { 内容: '理线夹 ×6 / 扎带 ×10 / 走线槽 2m', 材质: '硅胶 + 尼龙', 颜色: '深灰' },
    rating: 4.4
  },
  {
    id: 23,
    name: '云巢 铝合金笔记本支架',
    brand: '云巢',
    category: 'accessory',
    price: 89,
    stock: 0,
    image: '/assets/products/acc-2.svg',
    tagline: '抬高视线，颈椎舒服很多',
    tags: ['支架', '配件', '笔记本', '桌面', '人体工学'],
    desc: '六档高度可调，铝合金材质散热快。抬高屏幕至视线水平，久坐办公脖子不酸。',
    specs: { 材质: '铝合金', 档位: '6 档可调', 适配: '11~17 英寸', 承重: '10kg' },
    rating: 4.5
  },
  {
    id: 24,
    name: '聆音 大号加厚鼠标垫',
    brand: '聆音',
    category: 'accessory',
    price: 59,
    stock: 160,
    image: '/assets/products/acc-3.svg',
    tagline: '800×300mm，键盘鼠标一起放',
    tags: ['鼠标垫', '配件', '桌面', '便宜'],
    desc: '800×300mm 大尺寸，键盘鼠标都能放在上面。4mm 加厚天然橡胶底，防滑且手腕舒适。',
    specs: { 尺寸: '800×300×4mm', 表面: '细面编织', 底部: '天然橡胶', 包边: '锁边工艺' },
    rating: 4.3
  }
];

module.exports = { categories, products };
