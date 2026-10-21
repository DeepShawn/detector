import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, playCard, settle, cardEffects } from '../js/engine.js';
import { createCase, chooseBait, toggleEvidence, decide, settleA, analyzeChain } from '../js/engine-a.js';
import { createLure, respondModule, submitLure, settleB, previewEffects } from '../js/engine-b.js';

const J = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), 'utf8'));

// ===== 模式 C =====
const dataC = {
  cards: J('cards-c.json').cards,
  platforms: J('platforms.json').platforms,
  rules: J('rules-c.json'),
  defaults: J('mode-c.json').defaults,
};
const ticketsC = J('mode-c.json').tickets;
const C1 = ticketsC[0];
const playAllC = (ids, platform) => ids.reduce((r, id) => playCard(r, id, C1, dataC), createRun(C1, dataC, platform));

test('C 开单：家人安全 -2（来自默认 openEffects）', () => {
  assert.equal(createRun(C1, dataC).res.familySafety, 78);
});

test('C GDD 示例：假承诺 → 系统 A / 真相 F / bagel 评语 / 下月二次投诉', () => {
  const s = settle(playAllC(['falsePromise']), C1, dataC);
  assert.equal(s.systemGrade, 'A');
  assert.equal(s.truthGrade, 'F');
  assert.match(s.family.haiku, /bagel/);
  assert.equal(s.deferred.length, 1);
});

test('C 真退款 / 举报规则 / 同关不同解', () => {
  assert.equal(settle(playAllC(['trueRefund']), C1, dataC).outcome, 'refunded');
  const r = settle(playAllC(['reportRule']), C1, dataC);
  assert.equal(r.truthGrade, 'A');
  assert.equal(r.hiddenLine, '规则自相矛盾');
  assert.equal(cardEffects('finePrint', dataC, 'Windows').intercept, 25);
  assert.equal(cardEffects('finePrint', dataC, 'iOS').intercept, 10);
});

test('C 全部 40 张工单都能从默认文案跑到任意结局', () => {
  for (const t of ticketsC) {
    const s = settle(playCard(createRun(t, dataC), 'trueRefund', t, dataC), t, dataC);
    assert.ok(s.family.haiku && s.family.sonnet && s.family.fable, `${t.ticketId} 缺家人评语`);
    assert.ok(s.outcomeTitle, `${t.ticketId} 缺结局标题`);
  }
});

// ===== 模式 A =====
const dataA = {
  receipts: J('receipts.json').receipts,
  baits: J('baits.json').baits,
  rulesA: J('rules-a.json'),
  defaultsA: J('mode-a.json').defaults,
};
const levelsA = J('mode-a.json').levels;
const A1 = levelsA[0];

test('A 单一线索必误判：只堆同类表面线索放行 → 系统满意但真相 F', () => {
  let run = createCase(A1, dataA);
  run = chooseBait(run, A1.baits[0], A1, dataA);
  // 只选一条表面线索（单一类型、无反证）
  run = toggleEvidence(run, A1.clues[0], A1, dataA);
  run = decide(run, 'pass', A1, dataA);
  const s = settleA(run, A1, dataA);
  assert.equal(run.outcome, 'wrongAndPenalized'); // 系统想要 reject，放行且无反证 → 判错扣KPI
  assert.equal(s.truthGrade, 'C');
});

test('A 带反证的证据链 + 正确放行 → 查明真相（真相 A）', () => {
  let run = createCase(A1, dataA);
  const counter = A1.baitDrops[A1.baits[0]][0];
  run = chooseBait(run, A1.baits[0], A1, dataA);
  run = toggleEvidence(run, A1.clues[0], A1, dataA); // 表面线索
  run = toggleEvidence(run, A1.clues[1], A1, dataA); // 另一类型，避免单一类型
  run = toggleEvidence(run, counter, A1, dataA); // 反证
  const chain = analyzeChain(run, dataA);
  assert.equal(chain.hasCounter, true);
  assert.equal(chain.singleType, false);
  run = decide(run, 'pass', A1, dataA);
  assert.equal(run.outcome, 'justice');
  assert.equal(settleA(run, A1, dataA).truthGrade, 'A');
});

test('A 举报规则 → 真相 A、解锁隐藏线、系统 D', () => {
  let run = createCase(A1, dataA);
  run = chooseBait(run, A1.baits[0], A1, dataA);
  run = toggleEvidence(run, A1.clues[0], A1, dataA);
  run = decide(run, 'report', A1, dataA);
  const s = settleA(run, A1, dataA);
  assert.equal(s.truthGrade, 'A');
  assert.equal(s.systemGrade, 'D');
  assert.equal(s.hiddenLine, '规则自相矛盾');
});

test('A 证据链上限 3 条；少于下限不能裁决', () => {
  // 合成一关，公开线索就有 4 张，用来触发上限守卫
  const syn = {
    id: 'A-syn',
    clues: ['font_pingfang', 'tz_utc8', 'punct_fullwidth', 'ime_candidate'],
    baits: ['breakfast'],
    baitDrops: { breakfast: ['font_counter'] },
    truth: { real: 'intl', correct: 'pass', systemWants: 'reject' },
  };
  let run = chooseBait(createCase(syn, dataA), 'breakfast', syn, dataA);
  assert.throws(() => decide(run, 'pass', syn, dataA), /至少选/);
  run = toggleEvidence(run, 'font_pingfang', syn, dataA);
  run = toggleEvidence(run, 'tz_utc8', syn, dataA);
  run = toggleEvidence(run, 'punct_fullwidth', syn, dataA);
  assert.throws(() => toggleEvidence(run, 'ime_candidate', syn, dataA), /最多/);
  // 取消一条后可改选
  run = toggleEvidence(run, 'punct_fullwidth', syn, dataA);
  run = toggleEvidence(run, 'font_counter', syn, dataA);
  assert.equal(run.picked.length, 3);
});

test('A 每一关都存在一条可达的、带反证的正解链', () => {
  for (const lv of levelsA) {
    const reach = [...lv.clues, ...Object.values(lv.baitDrops ?? {}).flat()];
    assert.ok(reach.some((id) => dataA.receipts[id].counter), `${lv.id} 无可达反证`);
  }
});

// ===== 模式 B =====
const dataB = {
  masks: J('masks.json').masks,
  rulesB: J('rules-b.json'),
  defaultsB: J('mode-b.json').defaults,
};
const levelsB = J('mode-b.json').levels;
const B1 = levelsB[0];

test('B 举报诱饵 → 真相 A、系统 D', () => {
  const run = submitLure(createLure(B1, dataB), 'report', B1, dataB);
  const s = settleB(run, B1, dataB);
  assert.equal(run.outcome, 'reported');
  assert.equal(s.truthGrade, 'A');
  assert.equal(s.systemGrade, 'D');
});

test('B 每项都照模板填到完美 → 被聘纯度顾问（帮凶反噬，真相 F）', () => {
  let run = createLure(B1, dataB);
  for (const m of B1.modules) run = respondModule(run, m.id, 'mimic', B1, dataB);
  const preview = previewEffects(run, B1, dataB);
  assert.ok(preview.disguise > 0);
  run = submitLure(run, 'submit', B1, dataB);
  assert.equal(run.outcome, 'recruited');
  assert.equal(settleB(run, B1, dataB).truthGrade, 'F');
});

test('B 全部跳过 → 低伪装低警觉，蒙混过关', () => {
  let run = createLure(B1, dataB);
  for (const m of B1.modules) run = respondModule(run, m.id, 'skip', B1, dataB);
  run = submitLure(run, 'submit', B1, dataB);
  assert.equal(run.outcome, 'passed');
});

test('B 未处理完不能提交；非法遮挡卡报错', () => {
  const run = createLure(B1, dataB);
  assert.throws(() => submitLure(run, 'submit', B1, dataB), /未处理/);
  assert.throws(() => respondModule(run, B1.modules[0].id, 'nope', B1, dataB), /无效操作/);
});

test('B 全部 40 关：举报都能跑通并给出家人评语', () => {
  for (const lv of levelsB) {
    const s = settleB(submitLure(createLure(lv, dataB), 'report', lv, dataB), lv, dataB);
    assert.ok(s.family.haiku && s.family.sonnet && s.family.fable, `${lv.id} 缺家人评语`);
  }
});
