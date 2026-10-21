// 端到端冒烟测试：三模式在手机与桌面布局下各跑通一关，验证布局差异与结算。
// 用法：npm run e2e   （SCREENSHOTS=目录 可保存截图）

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = p === '/' ? 'index.html' : p;
  try {
    const body = await readFile(path.join(root, file));
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const shotDir = process.env.SCREENSHOTS;
if (shotDir) await mkdir(shotDir, { recursive: true });
const shot = (page, name) => (shotDir ? page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true }) : null);

const browser = await chromium.launch();
const errors = [];
async function open(viewport, mobile) {
  const c = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await c.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.locator('[data-act="ack"]').click();
  await page.locator('.home').waitFor();
  return page;
}
const enter = async (page, mode, idx = 0) => {
  await page.locator(`.mode-card[data-mode="${mode}"]`).click();
  await page.locator('.level-grid').waitFor();
  await page.locator('.level-card').nth(idx).click();
  await page.locator('.desk').waitFor();
};

try {
  // ---- 手机：底部分步标签可见，一次一个 pane ----
  const phone = await open({ width: 390, height: 844 }, true);
  await shot(phone, 'c1-home');
  assert.equal(await phone.locator('.mode-card').count(), 3);

  // 模式 C：假承诺 → 系统 A / 真相 F
  await enter(phone, 'c', 0);
  assert.ok(await phone.locator('.steps').isVisible(), '手机应显示分步标签');
  await shot(phone, 'c2-deskC-phone');
  await phone.locator('.steps button[data-step="scripts"]').click();
  await phone.locator('[data-card="falsePromise"]').click();
  await phone.locator('[data-act="play"]').click();
  await phone.locator('.settle').waitFor();
  assert.equal(await phone.locator('.grade.sys b').textContent(), 'A');
  assert.equal(await phone.locator('.grade.truth b').textContent(), 'F');
  await shot(phone, 'c3-settleC');
  await phone.locator('.actions [data-act="back"]').click();
  await phone.locator('[data-act="home"]').click();

  // 模式 A：选诱饵 → 组带反证的链 → 放行 → 真相 A
  await enter(phone, 'a', 0);
  await phone.locator('[data-bait]').first().click();
  await phone.locator('.steps button[data-step="evidence"]').click();
  const receipts = phone.locator('[data-receipt]');
  await receipts.nth(0).click();
  await receipts.nth(1).click();
  // 找到反证并选中
  const counter = phone.locator('.receipt.counter').first();
  await counter.click();
  await phone.locator('.steps button[data-step="verdict"]').click();
  await shot(phone, 'c4-deskA-phone');
  await phone.locator('[data-decide="pass"]').click();
  await phone.locator('.settle').waitFor();
  assert.equal(await phone.locator('.grade.truth b').textContent(), 'A');
  await phone.locator('.actions [data-act="back"]').click();
  await phone.locator('[data-act="home"]').click();

  // 模式 B：举报诱饵 → 真相 A
  await enter(phone, 'b', 0);
  await phone.locator('.steps button[data-step="submit"]').click();
  await shot(phone, 'c5-deskB-phone');
  await phone.locator('[data-submit="report"]').click();
  await phone.locator('.settle').waitFor();
  assert.equal(await phone.locator('.grade.truth b').textContent(), 'A');

  // ---- 桌面：分步标签隐藏，多栏并列 ----
  const desk = await open({ width: 1440, height: 900 }, false);
  await enter(desk, 'c', 1);
  assert.equal(await desk.locator('.steps').isVisible(), false, '桌面应隐藏分步标签');
  const cols = await desk.locator('.desk').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(cols, 3, '桌面模式C应三栏');
  assert.equal(await desk.locator('.pane[data-pane="scripts"]').isVisible(), true, '桌面所有 pane 同时可见');
  await shot(desk, 'd1-deskC-desktop');
  await desk.locator('[data-card="reportRule"]').click();
  await desk.locator('[data-act="play"]').click();
  await desk.locator('.settle').waitFor();
  assert.match(await desk.locator('.hidden-line').textContent(), /规则自相矛盾/);
  await shot(desk, 'd2-settle-desktop');

  // 模式 B 桌面：照模板填满 → 被聘纯度顾问（真相 F）
  await desk.locator('.actions [data-act="back"]').click();
  await desk.locator('[data-act="home"]').click();
  await enter(desk, 'b', 0);
  for (const mod of await desk.locator('.module').all()) await mod.locator('.opt[data-action="mimic"]').click(); // 照抄模板
  await desk.locator('[data-submit="submit"]').click();
  await desk.locator('.settle').waitFor();
  assert.equal(await desk.locator('.grade.truth b').textContent(), 'F');
  await shot(desk, 'd3-settleB');

  assert.deepEqual(errors, [], `页面报错：\n${errors.join('\n')}`);
  console.log('✓ 冒烟测试通过：三模式 × 手机/桌面布局、证据链、举报、帮凶反噬、结算');
} finally {
  await browser.close();
  server.close();
}
