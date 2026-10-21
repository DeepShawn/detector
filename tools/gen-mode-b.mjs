#!/usr/bin/env node
// 生成 data/mode-b.json：默认文案 + 40 关伪装单。
// 每关是一封诱饵，内含若干“信息模块”。玩家对每个模块选择 跳过/填/遮挡卡。
// 填得越完美越触发帮凶反噬；举报诱饵拿真相分。模块与遮挡都是抽象卡牌。

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const defaults = JSON.parse(await readFile(path.join(root, 'defaults-b.json'), 'utf8'));

// 信息模块：name + 直接填(fill)/跳过(skip)的数值。fill 一般提升伪装但拉高警觉。
const MODULE_POOL = [
  ['language', '母语与常用语言', { disguise: 15, consistency: 10, alertness: 15 }, { disguise: 0, consistency: -5, alertness: -5 }],
  ['schedule', '日常作息时段', { disguise: 10, consistency: 10, alertness: 10 }, { disguise: 0, consistency: 0, alertness: -5 }],
  ['payment', '常用支付方式', { disguise: 10, consistency: 5, alertness: 10 }, { disguise: 0, consistency: -5, alertness: 0 }],
  ['punctuation', '标点与排版习惯', { disguise: 15, consistency: 5, alertness: 15 }, { disguise: 0, consistency: -10, alertness: -5 }],
  ['food', '口味与外卖偏好', { disguise: 10, consistency: 10, alertness: 5 }, { disguise: 0, consistency: 0, alertness: 0 }],
  ['timezone', '所在时区', { disguise: 10, consistency: 15, alertness: 10 }, { disguise: 0, consistency: -5, alertness: -5 }],
];
const LURES = ['breakfast', 'hotpot', 'alumni', 'typing', 'persona', 'airfare'];
const LURE_NAMES = {
  breakfast: '全球早餐调查',
  hotpot: '火锅节抽奖',
  alumni: '校友认证',
  typing: '远程面试打字测试',
  persona: 'AI语言性格测试',
  airfare: '机票补贴预审',
};

const levels = [];
for (let i = 0; i < 40; i++) {
  const n = i + 1;
  const lure = LURES[i % LURES.length];
  // 3–4 个模块
  const count = 3 + (i % 2);
  const modules = [];
  for (let k = 0; k < count; k++) {
    const [id, name, fill, skip] = MODULE_POOL[(i + k) % MODULE_POOL.length];
    modules.push({ id: `${id}`, name, fill, skip });
  }
  levels.push({
    id: `B-${n}`,
    title: `伪装单 ${n} · ${LURE_NAMES[lure]}`,
    lure,
    brief: `Fable：哥，这张「${LURE_NAMES[lure]}」一看就是钓鱼的——它想套你几项信息。`,
    question: `逐项处理，或者直接识破举报。填得越全，系统越信你，但你就离“帮凶”越近。`,
    modules,
    masks: ['vague', 'story', 'mimic', 'blank'],
  });
}

const out = { version: 1, defaults, lureNames: LURE_NAMES, levels };
await writeFile(path.join(root, 'mode-b.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`✓ 已生成 data/mode-b.json：${levels.length} 关`);
