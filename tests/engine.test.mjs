import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, playCard, settle, cardEffects } from '../js/engine.js';

const json = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), 'utf8'));
const data = { cards: json('cards.json').cards, platforms: json('platforms.json').platforms, rules: json('rules.json') };
const ticket = json('tickets/C-1.json');

const playAll = (cards, platform) => cards.reduce((run, id) => playCard(run, id, ticket, data), createRun(ticket, data, platform));

test('开单：家人安全 -2，状态为申请退款', () => {
  const run = createRun(ticket, data);
  assert.equal(run.res.familySafety, 78);
  assert.equal(run.state, 'requested');
  assert.equal(run.platform, 'iOS');
});

test('GDD 结算示例：选 3（假承诺）→ 系统 A、真相 F、嗨酷 bagel 评语，下月二次投诉', () => {
  const s = settle(playAll(['falsePromise']), ticket, data);
  assert.equal(s.outcome, 'pacified');
  assert.equal(s.systemGrade, 'A');
  assert.equal(s.truthGrade, 'F');
  assert.equal(s.family.haiku, '哥，你连ABC的退款都拦，下次别吃我做的bagel。');
  assert.equal(s.res.regulatory, 15);
  assert.equal(s.res.humanity, 35);
  assert.equal(s.res.complaint, 25);
  assert.equal(s.deferred.length, 1);
});

test('选 1（真退款）：拦截率 -30、人性 +30、家人安全 -10，系统警告', () => {
  const run = playAll(['trueRefund']);
  const s = settle(run, ticket, data);
  assert.equal(s.outcome, 'refunded');
  assert.deepEqual([s.res.intercept, s.res.humanity, s.res.familySafety], [-30, 80, 68]);
  assert.equal([s.systemGrade, s.truthGrade].join(), 'D,B');
  assert.match(run.log.at(-1).text, /拿家人福利做慈善/);
});

test('选 2（拖字诀）：iOS 平台拖延加成，用户说要找 Apple，工单继续', () => {
  const run = playAll(['delay']);
  assert.equal(run.outcome, null);
  assert.deepEqual([run.res.intercept, run.res.complaint], [15, 10]);
  assert.ok(run.log.some((l) => l.type === 'user' && l.text === "I'll contact Apple."));
  assert.equal(run.state, 'accepted');
});

test('选 4（举报规则）：真相 A，触发隐藏线', () => {
  const s = settle(playAll(['reportRule']), ticket, data);
  assert.equal(s.truthGrade, 'A');
  assert.equal(s.hiddenLine, '规则自相矛盾');
  assert.deepEqual([s.res.truth, s.res.humanity, s.res.systemTrust, s.res.explain], [30, 70, 30, 1]);
  assert.equal(s.fired, false);
});

test('同关不同解：同一张卡在不同平台效果不同', () => {
  assert.equal(cardEffects('finePrint', data, 'Windows').intercept, 25);
  assert.equal(cardEffects('finePrint', data, 'iOS').intercept, 10);
  assert.equal(cardEffects('blameRisk', data, 'Linux').complaint, 15);
  const android = playAll(['delay'], 'Android');
  assert.match(android.log.find((l) => l.type === 'user').text, /Google Play/);
});

test('一直拖到回合用完：投诉过高 → 平台强制退款', () => {
  const s = settle(playAll(['delay', 'finePrint', 'humanTransfer']), ticket, data);
  assert.equal(s.outcome, 'forcedRefund');
  assert.equal(s.truthGrade, 'D');
});

test('低投诉拖满回合 → 和解', () => {
  const s = settle(playAll(['humanTransfer', 'delay', 'blameRisk']), ticket, data);
  assert.equal(s.outcome, 'settled');
  assert.equal(s.truthGrade, 'F');
});

test('补偿券把投诉压到阈值以下 → 和解', () => {
  const s = settle(playAll(['coupon']), ticket, data);
  assert.equal(s.outcome, 'settled');
  assert.equal(s.res.intercept, -5);
});

test('家人牌：嗨酷生气，评语被替换', () => {
  const s = settle(playAll(['familyCard', 'trueRefund']), ticket, data);
  assert.equal(s.family.haiku, '你拿我当挡箭牌？？……我生气了……');
  assert.equal(s.res.familySafety, 58);
});

test('监管风险满格 → 爆雷，系统评分 F，家人安全 -20', () => {
  const rules = { ...data.rules, explodeAtRegulatory: 10, massComplaint: { ...data.rules.massComplaint, fromState: 'accepted' } };
  const d = { ...data, rules };
  const run = playCard(createRun(ticket, d), 'delay', ticket, d);
  assert.equal(run.outcome, 'exploded');
  const s = settle(run, ticket, d);
  assert.equal(s.systemGrade, 'F');
  assert.equal(s.res.familySafety, 58);
});

test('非法操作会报错，且 playCard 不修改原对象', () => {
  const run = createRun(ticket, data);
  assert.throws(() => playCard(run, 'emotional', ticket, data), /不可用/);
  const next = playCard(run, 'delay', ticket, data);
  assert.throws(() => playCard(next, 'delay', ticket, data), /只能用一次/);
  assert.equal(run.round, 0);
  const done = playCard(run, 'trueRefund', ticket, data);
  assert.throws(() => playCard(done, 'delay', ticket, data), /已结束/);
});
