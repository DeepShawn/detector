#!/usr/bin/env node
// 关卡校验：检查 levels/ 下所有关卡 JSON 是否符合 docs/DESIGN.md 中的结构。
// 用法：node tools/validate-levels.mjs   （有错误时退出码为 1）

import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'levels');
const CATEGORIES = ['timeline', 'item', 'testimony', 'chat', 'order'];
const errors = [];
const warnings = [];

const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const exists = (file) => access(path.join(root, file)).then(() => true, () => false);

function req(cond, where, msg) {
  if (!cond) errors.push(`${where}: ${msg}`);
  return cond;
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isPermutation = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x));
const isPositiveNumber = (v) => typeof v === 'number' && v > 0;

function checkUniqueIds(where, items) {
  const ids = items.map((it) => it.id);
  req(ids.every(isNonEmptyString), where, '每个条目都需要 id');
  req(new Set(ids).size === ids.length, where, `条目 id 重复：${ids.join(', ')}`);
  return ids;
}

async function validateScene(where, level) {
  const { content, answer } = level;
  req(isNonEmptyString(content.image), where, 'content.image 必填');
  if (content.image && !(await exists(content.image))) errors.push(`${where}: 找不到图片 levels/${content.image}`);
  req(isPositiveNumber(content.width) && isPositiveNumber(content.height), where, 'content.width/height 必须为正数');
  if (!req(answer.kind === 'hotspots', where, 'scene 关卡的 answer.kind 必须是 hotspots')) return;
  const spots = answer.hotspots ?? [];
  req(spots.length > 0, where, '至少需要 1 个热区');
  checkUniqueIds(`${where} hotspots`, spots);
  req(answer.maxMarks === spots.length, where, `maxMarks(${answer.maxMarks}) 应等于热区数量(${spots.length})`);
  for (const h of spots) {
    const w = `${where} 热区 ${h.id}`;
    req(isNonEmptyString(h.label) && isNonEmptyString(h.explain), w, '需要 label 和 explain');
    if (h.shape === 'rect') {
      req([h.x, h.y].every(Number.isFinite) && isPositiveNumber(h.w) && isPositiveNumber(h.h), w, 'rect 需要 x/y/w/h');
      req(h.x >= 0 && h.y >= 0 && h.x + h.w <= content.width && h.y + h.h <= content.height, w, '超出场景范围');
    } else if (req(h.shape === 'circle', w, 'shape 只能是 circle 或 rect')) {
      req([h.x, h.y].every(Number.isFinite) && isPositiveNumber(h.r), w, 'circle 需要 x/y/r');
      req(h.x >= 0 && h.y >= 0 && h.x <= content.width && h.y <= content.height, w, '圆心超出场景范围');
      if (h.r < 20) warnings.push(`${w}: 半径 ${h.r} 偏小，手机上不好点中（建议 ≥ 24）`);
    }
  }
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const [a, b] = [spots[i], spots[j]];
      if (a.shape === 'circle' && b.shape === 'circle' && Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) {
        warnings.push(`${where}: 热区 ${a.id} 与 ${b.id} 重叠，一个标记可能同时命中两处`);
      }
    }
  }
}

function validatePick(where, level) {
  const { content, answer } = level;
  let selectable = [];
  if (content.kind === 'chat') {
    req(isNonEmptyString(content.group), where, 'chat 需要 group（群名）');
    const msgs = content.messages ?? [];
    req(msgs.length > 0, where, 'chat 需要 messages');
    for (const m of msgs) req(isNonEmptyString(m.from) && isNonEmptyString(m.text), `${where} 消息 ${m.id}`, '需要 from 和 text');
    selectable = checkUniqueIds(`${where} messages`, msgs);
  } else {
    const sections = content.sections ?? [];
    req(sections.length > 0, where, 'testimony 需要 sections');
    const all = sections.flatMap((s) => s.items ?? []);
    checkUniqueIds(`${where} sections`, all);
    for (const s of sections) {
      req(['log', 'quote'].includes(s.style), `${where} 分组「${s.title}」`, 'style 只能是 log 或 quote');
      if (s.selectable) selectable.push(...s.items.map((it) => it.id));
    }
    req(selectable.length > 0, where, '至少一个分组需要 selectable: true');
  }
  if (!req(answer.kind === 'pick', where, `${content.kind} 关卡的 answer.kind 必须是 pick`)) return;
  const ids = answer.ids ?? [];
  req(ids.length > 0, where, 'answer.ids 不能为空');
  for (const id of ids) req(selectable.includes(id), where, `答案 ${id} 不存在或不可选`);
  req(answer.maxPicks === ids.length, where, `maxPicks(${answer.maxPicks}) 应等于答案数量(${ids.length})`);
  for (const id of ids) {
    if (!isNonEmptyString(answer.explain?.[id])) warnings.push(`${where}: 答案 ${id} 缺少 explain 解释`);
  }
}

function validateOrder(where, level) {
  const { content, answer } = level;
  const ids = checkUniqueIds(`${where} items`, content.items ?? []);
  req(ids.length >= 3, where, '排序题至少需要 3 个事件');
  if (!req(answer.kind === 'order', where, 'order 关卡的 answer.kind 必须是 order')) return;
  req(isPermutation(ids, answer.sequence ?? []), where, 'answer.sequence 必须包含且仅包含全部事件');
  req(isPermutation(ids, content.initialOrder ?? []), where, 'content.initialOrder 必须包含且仅包含全部事件');
  if (JSON.stringify(content.initialOrder) === JSON.stringify(answer.sequence)) {
    errors.push(`${where}: initialOrder 与正确答案相同，开局即通关`);
  }
}

async function validateLevel(id) {
  const where = `${id}.json`;
  let level;
  try {
    level = await readJson(`${id}.json`);
  } catch (err) {
    errors.push(`${where}: 无法读取或解析（${err.message}）`);
    return;
  }
  req(level.id === id, where, `id 字段(${level.id})应与文件名一致`);
  for (const key of ['title', 'brief', 'question', 'hint', 'summary']) req(isNonEmptyString(level[key]), where, `${key} 必填`);
  req(CATEGORIES.includes(level.category), where, `category 必须是 ${CATEGORIES.join('/')}`);
  req(Number.isInteger(level.difficulty) && level.difficulty >= 1 && level.difficulty <= 3, where, 'difficulty 为 1–3');
  req(Number.isInteger(level.timeLimit) && level.timeLimit >= 20, where, 'timeLimit 为不少于 20 的整数（秒）');
  if (!req(level.content && level.answer, where, '缺少 content 或 answer')) return;

  switch (level.content.kind) {
    case 'scene':
      await validateScene(where, level);
      break;
    case 'chat':
    case 'testimony':
      validatePick(where, level);
      break;
    case 'order':
      validateOrder(where, level);
      break;
    default:
      errors.push(`${where}: 未知的 content.kind「${level.content.kind}」`);
  }
}

const manifest = await readJson('index.json');
req(Array.isArray(manifest.levels) && manifest.levels.length > 0, 'index.json', 'levels 列表不能为空');
req(new Set(manifest.levels).size === manifest.levels.length, 'index.json', '关卡 id 重复');
for (const id of manifest.levels) await validateLevel(id);

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} 个错误`);
  process.exit(1);
}
console.log(`✓ ${manifest.levels.length} 个关卡校验通过${warnings.length ? `（${warnings.length} 条提醒）` : ''}`);
