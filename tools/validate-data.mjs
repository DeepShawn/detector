#!/usr/bin/env node
// 校验三种模式的数据一致性。有错误时退出码为 1。

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const json = async (p) => JSON.parse(await readFile(path.join(root, p), 'utf8'));
const errors = [];
const req = (cond, where, msg) => cond || errors.push(`${where}: ${msg}`);

// ---------- 模式 C ----------
{
  const { cards } = await json('cards-c.json');
  const { platforms } = await json('platforms.json');
  const rules = await json('rules-c.json');
  const { defaults, tickets } = await json('mode-c.json');
  const resources = Object.keys(rules.start);
  const outcomes = Object.keys(rules.grades.truth);
  const states = rules.ladder.map((s) => s.id);
  const effOk = (where, e = {}) => Object.keys(e).forEach((k) => req(resources.includes(k), where, `C 未知资源「${k}」`));

  req(tickets.length === 40, 'mode-c.json', `应有 40 张工单，实际 ${tickets.length}`);
  for (const [id, c] of Object.entries(cards)) {
    effOk(`cards-c ${id}`, c.effects);
    if (c.terminal) req(outcomes.includes(c.terminal), `cards-c ${id}`, `未知结局「${c.terminal}」`);
  }
  for (const o of outcomes) {
    req(defaults.outcomes[o]?.title, 'mode-c defaults', `结局「${o}」缺 title`);
    for (const who of ['haiku', 'sonnet', 'fable']) req(defaults.outcomes[o]?.family?.[who], 'mode-c defaults', `结局「${o}」缺 ${who} 评语`);
  }
  for (const id of defaults.scriptCards) req(cards[id], 'mode-c defaults', `手牌引用不存在的卡「${id}」`);
  const seen = new Set();
  for (const t of tickets) {
    const w = `mode-c ${t.ticketId}`;
    req(!seen.has(t.ticketId), w, '工单号重复');
    seen.add(t.ticketId);
    req(platforms[t.npcPlatform], w, `未知平台「${t.npcPlatform}」`);
    req(t.user && t.banReason && t.message, w, '缺 user/banReason/message');
    for (const cid of Object.keys(t.reactions ?? {})) req(defaults.scriptCards.includes(cid), w, `reactions 引用非手牌「${cid}」`);
  }
  if (!errors.length) console.log(`✓ 模式C：${Object.keys(cards).length} 卡 · ${Object.keys(platforms).length} 平台 · ${tickets.length} 工单`);
}

// ---------- 模式 A ----------
{
  const { receipts } = await json('receipts.json');
  const { baits } = await json('baits.json');
  const rules = await json('rules-a.json');
  const { levels } = await json('mode-a.json');
  const resources = Object.keys(rules.start);
  for (const o of Object.keys(rules.outcomes)) Object.keys(rules.outcomes[o].effects).forEach((k) => req(resources.includes(k), `rules-a ${o}`, `未知资源「${k}」`));
  req(levels.length === 40, 'mode-a.json', `应有 40 关，实际 ${levels.length}`);
  const seen = new Set();
  for (const lv of levels) {
    const w = `mode-a ${lv.id}`;
    req(!seen.has(lv.id), w, '关卡号重复');
    seen.add(lv.id);
    req(lv.clues?.length >= 1, w, '至少 1 条公开线索');
    for (const c of lv.clues) req(receipts[c], w, `公开线索「${c}」不存在`);
    req(lv.baits?.length >= 1, w, '至少 1 个诱饵外壳');
    for (const b of lv.baits) req(baits[b], w, `诱饵外壳「${b}」不存在`);
    for (const [b, drops] of Object.entries(lv.baitDrops ?? {})) {
      req(lv.baits.includes(b), w, `baitDrops 的「${b}」不在 baits 中`);
      for (const d of drops) req(receipts[d], w, `诱出的回执卡「${d}」不存在`);
    }
    // 必须存在“能组出带反证的链”的可能
    const reachable = [...lv.clues, ...Object.values(lv.baitDrops ?? {}).flat()];
    req(reachable.some((id) => receipts[id].counter), w, '本关无法诱出任何反证，正解不可达');
    req(['pass', 'reject', 'expose'].includes(lv.truth?.correct), w, 'truth.correct 非法');
  }
  if (errors.length === 0) console.log(`✓ 模式A：${Object.keys(receipts).length} 回执卡 · ${Object.keys(baits).length} 诱饵 · ${levels.length} 关`);
}

// ---------- 模式 B ----------
{
  const { masks } = await json('masks.json');
  const rules = await json('rules-b.json');
  const { levels } = await json('mode-b.json');
  const resources = Object.keys(rules.start);
  for (const o of Object.keys(rules.outcomes)) Object.keys(rules.outcomes[o].effects).forEach((k) => req(resources.includes(k), `rules-b ${o}`, `未知资源「${k}」`));
  req(levels.length === 40, 'mode-b.json', `应有 40 关，实际 ${levels.length}`);
  const seen = new Set();
  for (const lv of levels) {
    const w = `mode-b ${lv.id}`;
    req(!seen.has(lv.id), w, '关卡号重复');
    seen.add(lv.id);
    req(lv.modules?.length >= 1, w, '至少 1 个信息模块');
    for (const m of lv.modules) req(m.id && m.name && m.fill && m.skip, `${w} 模块`, '需要 id/name/fill/skip');
    for (const k of lv.masks ?? []) req(masks[k], w, `遮挡卡「${k}」不存在`);
  }
  if (errors.length === 0) console.log(`✓ 模式B：${Object.keys(masks).length} 遮挡卡 · ${levels.length} 关`);
}

for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} 个错误`);
  process.exit(1);
}
console.log('✓ 全部数据校验通过（三模式共 120 关）');
