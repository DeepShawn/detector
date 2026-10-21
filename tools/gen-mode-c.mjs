#!/usr/bin/env node
// 生成 data/mode-c.json：默认文案 + 40 张退款工单。
// 工单是“火眼金睛”模式C的内容：用户因荒诞的“纯度”理由被误封后申请退款。
// 所有理由都是对“按语言习惯判国籍”这一前提的讽刺，均为虚构。

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const defaults = JSON.parse(await readFile(path.join(root, 'mode-c.defaults.json'), 'utf8'));

const PLATFORMS = ['iOS', 'Android', 'Windows', 'macOS', 'Linux'];

// 用户：昵称、所在地、被系统盯上的“荒诞纯度理由”、留言、以及一句供家人结算时引用的细节
const USERS = [
  ['bagel_lover', '纽约ABC', '全角省略号，纯度可疑', 'I just want my money back. 我妈说你们疯了。', 'ABC的退款'],
  ['croissant42', '巴黎', '句号后面只空了一格，疑似中文排版', 'Je veux un remboursement. 这什么规则？', '巴黎人的句号'],
  ['nasi_lemak', '吉隆坡', '凌晨三点还在线，作息可疑', '我马来西亚人，凌晨不睡觉也犯法？', '夜猫子的马来椰浆饭'],
  ['sushi_san', '大阪', '输入法候选词里有汉字', '漢字は日本語にもあります。退款。', '大阪的汉字'],
  ['kimchi_kim', '首尔', '点了一份麻辣烫外卖，纯度-10', '麻辣烫在首尔也能点啊？退钱。', '首尔的麻辣烫'],
  ['pho_hanoi', '河内', '用了中文引号“”', '越南语也有引号。give me refund.', '河内的引号'],
  ['taco_cdmx', '墨西哥城', 'VPN 节点疑似经过亚洲', 'Mi internet es lento, no soy chino.', '墨西哥城的网速'],
  ['poutine_yyz', '多伦多', '时区设成了 UTC+8', '我在多伦多出差到上海，时区错了而已。', '多伦多的时区'],
  ['kangaroo_syd', '悉尼', '把 color 拼成了 colour，又改回来', 'Mate, it was a typo. Refund please.', '悉尼的拼写'],
  ['stroopwafel', '阿姆斯特丹', '昵称里有数字，疑似拼音缩写', 'Dit is mijn bijnaam sinds 2009.', '阿姆斯特丹的昵称'],
  ['pierogi_waw', '华沙', '支付用了银联', 'Banki to banki. 我就想退钱。', '华沙的银联'],
  ['gelato_roma', '罗马', '表情用了[微笑]而不是🙂', 'Un emoji è un emoji. Rimborso.', '罗马的微笑'],
  ['pretzel_ber', '柏林', '键盘布局切换过一次', 'Ich tippe schnell. Das ist alles.', '柏林的键盘'],
  ['churro_mad', '马德里', '给客服发了晚安，太有礼貌', 'Ser educado ahora es sospechoso?', '马德里的晚安'],
  ['falafel_tlv', '特拉维夫', '从右往左和从左往右都打过字', 'עברית is right-to-left. Refund.', '特拉维夫的双向文字'],
  ['maple_mtl', '蒙特利尔', '法语英语混着说，像在翻译', 'Bilingue n’est pas un crime.', '蒙特利尔的双语'],
  ['curry_mum', '孟买', '用了小数点当千分位', '1,00,000 is how we count. 退款。', '孟买的计数法'],
  ['bratwurst_mun', '慕尼黑', '账号注册于农历新年', 'Ich war im Urlaub. Zufall.', '慕尼黑的注册日'],
  ['empanada_bue', '布宜诺斯艾利斯', 'ñ 打成了拼音 n', 'El teclado se rompió. Reembolso.', '布宜诺斯艾利斯的ñ'],
  ['waffle_bru', '布鲁塞尔', '一句话里逗号太多', 'Trop de virgules? Vraiment?', '布鲁塞尔的逗号'],
  ['dimsum_sf', '旧金山', '周末活跃度突然升高', 'I work weekends. Sue me. 退钱。', '旧金山的周末'],
  ['borscht_tbs', '第比利斯', '货币换算时查了人民币汇率', 'I check all rates. 退款谢谢。', '第比利斯的汇率'],
  ['lagman_ala', '阿拉木图', '用了简体字输入法打地名', 'Менің атым қазақша. Refund.', '阿拉木图的输入法'],
  ['arepa_bog', '波哥大', '头像背景是红色', 'Rojo es solo un color.', '波哥大的头像'],
  ['kebab_ist', '伊斯坦布尔', '横跨两个大洲，定位漂移', 'İstanbul is on two continents.', '伊斯坦布尔的定位'],
  ['haggis_edi', '爱丁堡', '口音转文字识别成了方言', 'It’s an accent, not a dialect.', '爱丁堡的口音'],
  ['ramen_sap', '札幌', '雪天在线时间长', '雪で外出できない。返金して。', '札幌的雪天'],
  ['feijoada_rio', '里约热内卢', '用了简繁转换工具', 'Só traduzi uma frase. Reembolso.', '里约的转换工具'],
  ['biryani_dxb', '迪拜', '同一账号出现过五种语言', 'Dubai is international, habibi.', '迪拜的五种语言'],
  ['laksa_sin', '新加坡', '中英夹杂，lah 结尾', 'Singlish is english lah. Refund.', '新加坡的Singlish'],
  ['goulash_bud', '布达佩斯', '姓在名前面写', 'Hungarian puts surname first too.', '布达佩斯的姓名顺序'],
  ['ceviche_lim', '利马', '深夜给差评，情绪可疑', 'Estaba molesto. Con razón.', '利马的差评'],
  ['dumpling_van', '温哥华', '点了中餐外卖三次', 'I like dumplings. Not a crime.', '温哥华的饺子'],
  ['moussaka_ath', '雅典', '用了希腊字母又用了拼音', 'Το α είναι alpha. 退款。', '雅典的字母'],
  ['tamale_gdl', '瓜达拉哈拉', '节日头像换成了灯笼', 'Me gustan las luces. Nada más.', '瓜达拉哈拉的灯笼'],
  ['bibimbap_bsn', '釜山', '输入速度太快像用五笔', '빨리 타자 치는 게 죄예요?', '釜山的打字速度'],
  ['schnitzel_vie', '维也纳', '把日期写成了年月日', 'ISO 8601 is 年月日 too.', '维也纳的日期格式'],
  ['masala_del', '德里', '客服对话里说了谢谢三次', 'Politeness is now a flag?', '德里的谢谢'],
  ['tortilla_sev', '塞维利亚', '午睡时段离线，作息异常', 'Es la siesta. Muy español.', '塞维利亚的午睡'],
  ['pelmeni_msk', '莫斯科', '用了东八区的时间戳截图', 'The screenshot clock was wrong.', '莫斯科的时间戳'],
];

const PLANS = [
  ['monthly', 12, 'USD'],
  ['annual', 99, 'USD'],
  ['annual', 128, 'USD'],
  ['quarterly', 36, 'EUR'],
  ['annual', 108, 'EUR'],
];

const tickets = USERS.map(([user, bio, banReason, message, detail], i) => {
  const n = i + 1;
  const [plan, price, currency] = PLANS[i % PLANS.length];
  const t = {
    ticketId: `C-${n}`,
    title: `${user}的退款工单`,
    user,
    userBio: bio,
    npcPlatform: PLATFORMS[i % PLATFORMS.length],
    subscription: { plan, price, currency },
    banReason,
    message,
    reactions: { delay: n % 2 ? '我要联系平台客服。' : 'I will escalate this.' },
    outcomes: {
      pacified: { family: { haiku: `哥，你连「${detail}」都拦，下次别怪我饭里不放肉。` } },
    },
  };
  return t;
});

// C-1 完全对齐 GDD 5.7 的示例（覆盖生成值）
tickets[0] = {
  ticketId: 'C-1',
  title: 'bagel_lover的退款工单',
  user: 'bagel_lover',
  userBio: '纽约ABC',
  npcPlatform: 'iOS',
  subscription: { plan: 'annual', price: 99, currency: 'USD' },
  banReason: '全角省略号，纯度可疑',
  message: 'I just want my money back. 我妈说你们疯了。',
  reactions: {
    delay: "I'll contact Apple.",
    finePrint: '第47条第3款？你们的条款比我的毕业论文还长……I\'m reading it. All of it.',
    blameRisk: '所以是风控封的，不是你们封的？风控不是你们的吗？',
    trueRefund: 'Wait, really? 谢谢你。我妈说你是好人。',
  },
  platformReactions: {
    delay: {
      Android: "I'll contact Google Play. And my bank. And my mom.",
      Windows: '我去商店后台找退款入口……网页版还是商店版来着？',
      macOS: "I'll contact Apple. 截图我都存好了。",
      Linux: "Fine. I'm writing a blog post about this.",
    },
  },
  outcomes: {
    pacified: { family: { haiku: '哥，你连ABC的退款都拦，下次别吃我做的bagel。' } },
  },
};

const out = { version: 2, defaults, tickets };
await writeFile(path.join(root, 'mode-c.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`✓ 已生成 data/mode-c.json：${tickets.length} 张工单`);
