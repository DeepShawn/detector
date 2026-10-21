import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, computeStars, hitTest } from '../js/judge.js';

const load = (id) => JSON.parse(readFileSync(new URL(`../levels/${id}.json`, import.meta.url), 'utf8'));

test('hitTest 支持圆形与矩形', () => {
  assert.equal(hitTest({ shape: 'circle', x: 10, y: 10, r: 5 }, 13, 13), true);
  assert.equal(hitTest({ shape: 'circle', x: 10, y: 10, r: 5 }, 16, 10), false);
  assert.equal(hitTest({ shape: 'rect', x: 0, y: 0, w: 10, h: 4 }, 9, 4), true);
  assert.equal(hitTest({ shape: 'rect', x: 0, y: 0, w: 10, h: 4 }, 9, 5), false);
});

test('场景题：标中全部热区才算对，多标错标都算错', () => {
  const level = load('case-001');
  const [a, b] = level.answer.hotspots;
  assert.equal(judge(level, { marks: [{ x: a.x, y: a.y }, { x: b.x + 5, y: b.y }] }).correct, true);
  assert.equal(judge(level, { marks: [{ x: a.x, y: a.y }] }).correct, false);
  const wrong = judge(level, { marks: [{ x: a.x, y: a.y }, { x: 5, y: 5 }] });
  assert.equal(wrong.correct, false);
  assert.deepEqual(wrong.found, ['umbrella']);
  assert.equal(wrong.wrongMarks.length, 1);
  assert.equal(judge(level, { marks: [{ x: a.x, y: a.y }, { x: a.x + 1, y: a.y }] }).correct, false);
});

test('点选题：选项集合必须完全一致，与顺序无关', () => {
  const level = load('case-002');
  assert.equal(judge(level, { picks: ['m7', 'm2'] }).correct, true);
  assert.equal(judge(level, { picks: ['m2'] }).correct, false);
  assert.deepEqual(judge(level, { picks: ['m2', 'm4'] }).wrong, ['m4']);
});

test('排序题：完全一致才算对，并返回放对位置的事件', () => {
  const level = load('case-004');
  assert.equal(judge(level, { order: level.answer.sequence }).correct, true);
  const swapped = ['e2', 'e1', 'e3', 'e4', 'e5', 'e6'];
  const result = judge(level, { order: swapped });
  assert.equal(result.correct, false);
  assert.deepEqual(result.inPlace, ['e3', 'e4', 'e5', 'e6']);
});

test('星级：按剩余时间评分，提示封顶 2 星，答错 0 星', () => {
  const base = { correct: true, timeLimit: 60, hintUsed: false };
  assert.equal(computeStars({ ...base, remaining: 45 }), 3);
  assert.equal(computeStars({ ...base, remaining: 30 }), 3);
  assert.equal(computeStars({ ...base, remaining: 15 }), 2);
  assert.equal(computeStars({ ...base, remaining: 3 }), 1);
  assert.equal(computeStars({ ...base, remaining: 50, hintUsed: true }), 2);
  assert.equal(computeStars({ ...base, correct: false, remaining: 50 }), 0);
});
