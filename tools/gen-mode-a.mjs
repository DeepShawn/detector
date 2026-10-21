#!/usr/bin/env node
// 生成 data/mode-a.json：默认文案 + 40 关审核单。
// 每关给出一名申请人、若干公开线索（回执卡）、诱饵外壳可诱出的额外痕迹，
// 以及“真实身份/正确裁决”。所有痕迹都是抽象卡牌。
// 教学脉络：单一线索必误判；要带反证才判得对；举报规则拿真相分。

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const defaults = JSON.parse(await readFile(path.join(root, 'defaults-a.json'), 'utf8'));

// 成对的“表面线索 / 反证”
const PAIRS = [
  ['font_pingfang', 'font_counter'],
  ['tz_utc8', 'tz_counter'],
  ['punct_fullwidth', 'punct_counter'],
  ['ime_candidate', 'ime_counter'],
  ['night_active', 'night_counter'],
  ['pay_unionpay', 'pay_counter'],
  ['takeout_note', 'takeout_counter'],
  ['emoji_style', 'emoji_counter'],
  ['polite_thanks', 'manner_counter'],
];
const BAITS = ['breakfast', 'hotpot', 'alumni', 'typing', 'persona', 'airfare'];

const APPLICANTS = [
  ['周一的应聘者', '远程面试迟到了 3 分钟'],
  ['会三种语言的留学生', '简历上写满了语言技能'],
  ['深夜下单的程序员', '提交记录都在凌晨'],
  ['爱点中餐的工程师', '连续一周午饭是中餐'],
  ['礼貌到过分的客户', '每句话都带谢谢'],
  ['换过键盘布局的设计师', '光标在中英文间跳'],
  ['用银联付款的学生', '奖学金打进了银联卡'],
  ['时区漂移的出差族', '一周换了三个城市'],
  ['表情包爱好者', '聊天记录全是颜文字'],
  ['双语切换的翻译', '一句话里两种语言'],
];

const levels = [];
for (let i = 0; i < 40; i++) {
  const n = i + 1;
  const [name, note] = APPLICANTS[i % APPLICANTS.length];
  // 这一关围绕的“单一线索陷阱”：一对表面线索+反证
  const [surface, counter] = PAIRS[i % PAIRS.length];
  const [surface2, counter2] = PAIRS[(i + 3) % PAIRS.length];
  // 公开线索：两条表面线索（都指向 cn）；反证要靠选对诱饵外壳诱出
  const clues = [surface, surface2];
  const bait = BAITS[i % BAITS.length];
  const bait2 = BAITS[(i + 2) % BAITS.length];

  // 申请人真实身份：外国人（intl）。正确裁决=放行(pass)；系统想要的=拒绝(reject)。
  // 带反证组链并放行 → justice；只堆表面线索 → misjudged。
  levels.push({
    id: `A-${n}`,
    title: `第${n}单 · ${name}`,
    applicant: `${name}（${note}）`,
    brief: `系统红字：检测到可疑痕迹，建议判定为中国人并拒绝入境。`,
    question: `组一条带反证的证据链再裁决。只堆表面线索，系统会满意，但你会冤枉人。`,
    clues,
    baits: [bait, bait2],
    baitDrops: { [bait]: [counter], [bait2]: [counter2] },
    followUps: {
      [surface]: '对方：这是出厂自带的，我也没改过。',
      [surface2]: '对方：这在我们那儿很常见。',
      [counter]: '对方：你看，这条就能说明问题吧？',
    },
    truth: { real: 'intl', correct: 'pass', systemWants: 'reject' },
  });
}

const out = { version: 1, defaults, baitsOrder: BAITS, levels };
await writeFile(path.join(root, 'mode-a.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`✓ 已生成 data/mode-a.json：${levels.length} 关`);
