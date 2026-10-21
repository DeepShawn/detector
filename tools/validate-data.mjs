#!/usr/bin/env node
// 数据校验：卡牌、平台、规则、工单之间的引用是否一致。有错误时退出码为 1。

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const json = async (p) => JSON.parse(await readFile(path.join(root, p), 'utf8'));
const errors = [];
const req = (cond, where, msg) => cond || errors.push(`${where}: ${msg}`);

const { cards } = await json('cards.json');
const { platforms } = await json('platforms.json');
const rules = await json('rules.json');
const resources = Object.keys(rules.start);
const outcomes = Object.keys(rules.grades.truth);
const states = rules.ladder.map((s) => s.id);

const checkEffects = (where, effects = {}) => {
  for (const key of Object.keys(effects)) req(resources.includes(key), where, `未知资源「${key}」`);
};

req(JSON.stringify(Object.keys(rules.ranges).sort()) === JSON.stringify([...resources].sort()), 'rules.json', 'ranges 与 start 的资源必须一致');
req(rules.ladder[0]?.minComplaint === null, 'rules.json', '状态阶梯的第一个状态 minComplaint 必须为 null');
req(states.includes(rules.massComplaint.fromState), 'rules.json', 'massComplaint.fromState 不在状态阶梯中');
for (const o of [rules.timeout.below, rules.timeout.otherwise, ...Object.keys(rules.grades.systemOverride)]) {
  req(outcomes.includes(o), 'rules.json', `结局「${o}」没有真相评分`);
}

for (const [id, card] of Object.entries(cards)) {
  const where = `cards.json ${id}`;
  req(card.name && card.desc && card.system, where, '需要 name / desc / system');
  checkEffects(where, card.effects);
  checkEffects(`${where} deferred`, card.deferred?.effects);
  checkEffects(`${where} screenshot`, card.screenshot?.effects);
  if (card.terminal) req(outcomes.includes(card.terminal), where, `未知结局「${card.terminal}」`);
  if (card.screenshot) req(states.includes(card.screenshot.fromState), where, 'screenshot.fromState 不在状态阶梯中');
}

for (const [name, p] of Object.entries(platforms)) {
  for (const [cardId, mod] of Object.entries(p.modifiers ?? {})) {
    req(cards[cardId], `platforms.json ${name}`, `修正了不存在的卡牌「${cardId}」`);
    checkEffects(`platforms.json ${name}.${cardId}`, mod);
  }
}

const ticketFiles = (await readdir(path.join(root, 'tickets'))).filter((f) => f.endsWith('.json'));
for (const file of ticketFiles) {
  const t = await json(`tickets/${file}`);
  const where = `tickets/${file}`;
  req(`${t.ticketId}.json` === file, where, 'ticketId 应与文件名一致');
  req(platforms[t.npcPlatform], where, `未知设备平台「${t.npcPlatform}」`);
  req(t.refundState === states[0], where, `refundState 应为初始状态「${states[0]}」`);
  req(Number.isInteger(t.maxRounds) && t.maxRounds > 0, where, 'maxRounds 必须为正整数');
  req(t.scriptCards.length <= 10, where, '手牌最多 10 张（键盘 1–9、0）');
  checkEffects(`${where} openEffects`, t.openEffects);
  for (const id of t.scriptCards) {
    req(cards[id], where, `手牌引用了不存在的卡牌「${id}」`);
    req(t.reactions[id], where, `缺少卡牌「${id}」的用户反应`);
  }
  for (const [cardId, byPlatform] of Object.entries(t.platformReactions ?? {})) {
    for (const p of Object.keys(byPlatform)) req(platforms[p], where, `platformReactions.${cardId} 引用了未知平台「${p}」`);
  }
  for (const o of outcomes) {
    const def = t.outcomes[o];
    if (!req(def, where, `缺少结局「${o}」的文案`)) continue;
    req(def.title, where, `结局「${o}」缺少 title`);
    for (const who of ['haiku', 'sonnet', 'fable']) req(def.family?.[who], where, `结局「${o}」缺少 ${who} 的评语`);
    checkEffects(`${where} outcomes.${o}`, def.effects);
  }
  for (const flag of Object.keys(t.familyOverrides ?? {})) {
    req(Object.values(cards).some((c) => c.flag === flag), where, `familyOverrides.${flag} 没有卡牌会设置这个标记`);
  }
}

for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} 个错误`);
  process.exit(1);
}
console.log(`✓ 数据校验通过：${Object.keys(cards).length} 张话术卡、${Object.keys(platforms).length} 个平台、${ticketFiles.length} 张工单`);
