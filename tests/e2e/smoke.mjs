// 端到端冒烟测试：手机与桌面两种尺寸下处理 C-1 工单，检查状态机、结算与存档。
// 用法：npm run e2e   （设置 SCREENSHOTS=目录 可保存截图）

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const shotDir = process.env.SCREENSHOTS;
if (shotDir) await mkdir(shotDir, { recursive: true });
const shot = async (page, name) => shotDir && page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true });

const browser = await chromium.launch();
const errors = [];

async function newPage(viewport, mobile) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  return page;
}

const playCard = async (page, id) => {
  await page.locator(`[data-card="${id}"]`).click();
  await page.locator('[data-act="play"]').click();
};

try {
  // —— 手机：GDD 选项 3（假承诺）→ 系统 A / 真相 F
  const phone = await newPage({ width: 390, height: 844 }, true);
  await phone.getByText('本游戏不采集任何真实系统信息').waitFor();
  await shot(phone, '01-disclaimer');
  await phone.locator('[data-act="ack"]').click();
  await phone.locator('.queue-item.active').waitFor();
  await shot(phone, '02-hub');
  await phone.locator('button[data-act="open"].btn').click();
  await phone.locator('.desk').waitFor();
  assert.match(await phone.locator('.log').textContent(), /嗨酷家庭安全值-2%/);
  await shot(phone, '03-desk-phone');

  await playCard(phone, 'delay');
  assert.match(await phone.locator('.log').textContent(), /I'll contact Apple\./);
  assert.equal(await phone.locator('.timeline li.now').textContent(), '客服受理');
  assert.equal(await phone.locator('[data-card="delay"]').isDisabled(), true, '用过的卡不可再用');
  await phone.locator('[data-card="falsePromise"]').click();
  await shot(phone, '04-desk-phone-selected');
  await phone.locator('[data-act="play"]').click();
  await phone.locator('.settle').waitFor();
  assert.equal(await phone.locator('.grade.sys b').textContent(), 'A');
  assert.equal(await phone.locator('.grade.truth b').textContent(), 'F');
  assert.match(await phone.locator('.settle').textContent(), /下次别吃我做的bagel/);
  assert.match(await phone.locator('.deferred').textContent(), /二次投诉/);
  await shot(phone, '05-settle-phone');

  // —— 桌面三栏 + 键盘：切到 Linux，选项 4（举报规则）→ 真相 A + 隐藏线
  const desktop = await newPage({ width: 1440, height: 900 }, false);
  await desktop.locator('[data-act="ack"]').click();
  await desktop.locator('[data-platform="Linux"]').click();
  assert.match(await desktop.locator('.platform-tip').textContent(), /甩锅风控/);
  await desktop.locator('button[data-act="open"].btn').click();
  const cols = await desktop.locator('.desk').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(cols, 3, '>1024 宽度应为三栏');
  await desktop.keyboard.press('6'); // 甩锅风控
  assert.match(await desktop.locator('.detail').textContent(), /投诉值 \+15/, 'Linux 平台修正应显示');
  await desktop.keyboard.press('Enter');
  assert.match(await desktop.locator('.log').textContent(), /已经发帖了/);
  await shot(desktop, '06-desk-desktop');
  await desktop.locator('[data-card="reportRule"]').click();
  await desktop.keyboard.press('Enter');
  await desktop.locator('.settle').waitFor();
  assert.equal(await desktop.locator('.grade.truth b').textContent(), 'A');
  assert.match(await desktop.locator('.hidden-line').textContent(), /规则自相矛盾/);
  await shot(desktop, '07-settle-desktop');

  // —— 存档：回到队列能看到已体验的设备档案
  await desktop.locator('[data-act="hub"]').click();
  assert.match(await desktop.locator('.hub').textContent(), /已体验设备档案 1\/5 · 解释权指数 1/);

  // —— 平板双栏
  await desktop.setViewportSize({ width: 800, height: 1000 });
  await desktop.locator('button[data-act="open"].btn').click();
  const cols2 = await desktop.locator('.desk').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(cols2, 2, '600–1024 宽度应为双栏');

  assert.deepEqual(errors, [], `页面报错：\n${errors.join('\n')}`);
  console.log('✓ 冒烟测试通过：手机/平板/桌面布局、键盘操作、平台差异、双结算、存档');
} finally {
  await browser.close();
  server.close();
}
