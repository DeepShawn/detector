// 端到端冒烟测试：在手机尺寸的 Chromium 中通关全部 4 关，并检查存档、解锁与结算。
// 用法：npm run e2e   （设置 SCREENSHOTS=目录 可保存截图）

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

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
const shot = async (page, name) => shotDir && page.screenshot({ path: path.join(shotDir, `${name}.png`) });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const level = async (id) => JSON.parse(await readFile(path.join(root, 'levels', `${id}.json`), 'utf8'));

async function startCase() {
  await page.locator('[data-act="start"]').click();
  await page.locator('.intro').waitFor({ state: 'detached' });
}

async function expectWin(name) {
  await page.locator('[data-act="submit"]').click();
  await page.locator('.result.win').waitFor();
  assert.equal(await page.locator('.stamp').textContent(), '破案！');
  await page.waitForTimeout(400); // 等结算面板动画结束
  await shot(page, name);
}

try {
  await page.goto(base);
  await page.locator('.home h1').waitFor();
  await shot(page, '01-home');

  await page.locator('[data-nav="levels"]').click();
  assert.equal(await page.locator('.level-card.locked').count(), 3, '初始只解锁第 1 关');
  await shot(page, '02-levels');
  await page.locator('[data-play="case-001"]').click();
  await shot(page, '03-intro');
  await startCase();
  await shot(page, '04-scene');

  // 第 1 关：先点错一处再取消，验证可撤销；然后点中两个热区
  const l1 = await level('case-001');
  const vp = page.locator('.scene-viewport');
  const box = await vp.boundingBox();
  const tapScene = (x, y) => page.mouse.click(box.x + (x / l1.content.width) * box.width, box.y + (y / l1.content.height) * box.height);
  await tapScene(30, 30);
  assert.equal(await page.locator('.counter').textContent(), '已标记 1/2');
  await tapScene(30, 30);
  assert.equal(await page.locator('.counter').textContent(), '已标记 0/2');
  for (const h of l1.answer.hotspots) await tapScene(h.x, h.y);
  await expectWin('05-case1-win');
  assert.equal(await page.locator('.result-stars').textContent(), '★★★');

  // 第 2 关：聊天记录点选
  await page.locator('[data-act="next"]').click();
  await startCase();
  await shot(page, '06-chat');
  for (const id of (await level('case-002')).answer.ids) await page.locator(`.pickable[data-id="${id}"]`).click();
  await expectWin('07-case2-win');

  // 第 3 关：先答错，验证失败流程与“揭晓答案”，再重试答对
  await page.locator('[data-act="next"]').click();
  await startCase();
  await shot(page, '08-testimony');
  await page.locator('.pickable[data-id="t1"]').click();
  await page.locator('[data-act="submit"]').click();
  await page.locator('.result.lose').waitFor();
  await page.locator('[data-act="reveal"]').click();
  await page.locator('.pickable.is-answer[data-id="t3"]').waitFor();
  await shot(page, '09-testimony-reveal');
  await page.locator('[data-act="retry"]').click();
  await startCase();
  await page.locator('[data-act="hint"]').click();
  await page.locator('.pickable[data-id="t3"]').click();
  await expectWin('10-case3-win');
  assert.equal(await page.locator('.result-stars').textContent(), '★★☆', '用过提示最多 2 星');

  // 第 4 关：用拖拽 + 按钮把顺序排对
  await page.locator('[data-act="next"]').click();
  await startCase();
  await shot(page, '11-order');
  const sequence = (await level('case-004')).answer.sequence;
  for (let target = 0; target < sequence.length; target++) {
    const ids = await page.locator('.order-item').evaluateAll((els) => els.map((e) => e.dataset.id));
    let from = ids.indexOf(sequence[target]);
    if (target === 0 && from > 0) {
      // 第一步用真实拖拽，验证手势
      const handle = page.locator(`.order-item[data-id="${sequence[target]}"] .order-handle`);
      const first = await page.locator('.order-item').first().boundingBox();
      const hb = await handle.boundingBox();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      for (let s = 1; s <= 12; s++) {
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + ((first.y - hb.y - 10) * s) / 12);
      }
      await page.mouse.up();
      from = (await page.locator('.order-item').evaluateAll((els) => els.map((e) => e.dataset.id))).indexOf(sequence[target]);
      assert.equal(from, 0, '拖拽后应排到第一位');
    }
    for (; from > target; from--) {
      await page.locator(`.order-item[data-id="${sequence[target]}"] [data-move="-1"]`).click();
    }
  }
  await expectWin('12-case4-win');
  assert.equal(await page.locator('[data-act="next"]').count(), 0, '最后一关没有“下一关”');

  // 分享：无系统分享时应下载成绩卡
  const download = page.waitForEvent('download');
  await page.locator('[data-act="share"]').click();
  assert.match((await download).suggestedFilename(), /case-004\.png$/);

  // 存档：刷新后进度仍在
  await page.locator('.result [data-act="exit"]').click();
  await page.reload();
  await page.locator('.level-list').waitFor();
  assert.equal(await page.locator('.level-card.locked').count(), 0, '刷新后进度与解锁仍在');
  await page.locator('[data-nav="back"]').click();
  await page.locator('.home h1').waitFor();
  assert.equal(await page.locator('.stats b').first().textContent(), '4/4');
  await shot(page, '13-home-done');
  await page.locator('[data-nav="archive"]').click();
  assert.equal(await page.locator('.archive-item:not(.sealed)').count(), 4);
  await shot(page, '14-archive');

  // 重置进度
  await page.goBack();
  await page.locator('[data-nav="settings"]').click();
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-reset]').click();
  await page.goBack();
  assert.equal(await page.locator('.stats b').first().textContent(), '0/4');

  assert.deepEqual(errors, [], `页面报错：\n${errors.join('\n')}`);
  console.log('✓ 冒烟测试通过：4 关通关、失败/揭晓、提示、分享、存档、重置');
} finally {
  await browser.close();
  server.close();
}
