// 入口：启动声明 → 首页（选模式）→ 关卡列表 → 对应模式视图。
// 布局差异由 CSS 承担：手机为底部导航 + 分步标签；桌面为侧栏 + 多栏并列。
import { save } from './storage.js';
import { esc } from './ui.js';
import { renderDeskC } from './view-c.js';
import { renderCaseA } from './view-a.js';
import { renderDeskB } from './view-b.js';

const app = document.getElementById('app');
let D = {}; // 全部数据
let keyHandler = null;

const MODES = {
  a: { name: '模式A · 抓人', sub: '审核员：拼证据链，别被单一线索骗了', icon: '🔍' },
  b: { name: '模式B · 装人', sub: '伪装者：识破诱饵，举报才是正解', icon: '🎭' },
  c: { name: '模式C · 拦退款', sub: '退款客服：拦得越狠，监管越近', icon: '💳' },
};

function setKey(h) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = h;
  if (h) document.addEventListener('keydown', h);
}

const ctx = {
  get data() { return D; },
  go,
  onKey: setKey,
};

function go(screen, params = {}, replace = false) {
  const state = { screen, params };
  if (replace) history.replaceState(state, '');
  else history.pushState(state, '');
  render(state);
}
window.addEventListener('popstate', (e) => render(e.state ?? { screen: 'home', params: {} }));

function render({ screen, params }) {
  setKey(null);
  app.replaceChildren();
  window.scrollTo(0, 0);
  if (screen === 'home') return renderHome();
  if (screen === 'list') return renderList(params.mode);
  if (screen === 'play') return renderPlay(params.mode, params.id);
  renderHome();
}

function levelsOf(mode) {
  if (mode === 'a') return D.modeA.levels;
  if (mode === 'b') return D.modeB.levels;
  return D.modeC.tickets;
}
const idOf = (mode, lv) => (mode === 'c' ? lv.ticketId : lv.id);

function renderHome() {
  const total = 120;
  const solved = save.solvedCount('a') + save.solvedCount('b') + save.solvedCount('c');
  app.innerHTML = `
    <div class="screen home">
      <div class="logo">🕵️</div>
      <h1>火眼金睛</h1>
      <p class="slogan">A社临时审核员的赛博养家模拟器</p>
      <div class="stats"><div><b>${solved}/${total}</b><span>已通关卡</span></div><div><b>${save.explainTotal}</b><span>解释权指数</span></div></div>
      <div class="mode-cards">
        ${Object.entries(MODES).map(([m, info]) => `<button class="mode-card" data-mode="${m}"><span class="mode-icon">${info.icon}</span><span><strong>${esc(info.name)}</strong><small>${esc(info.sub)} · ${levelsOf(m).length} 关</small></span><span class="mode-prog">${save.solvedCount(m)}/${levelsOf(m).length}</span></button>`).join('')}
      </div>
      <p class="anchor small">虚构黑色喜剧 · 不采集任何真实系统信息 · 所有设备档案与卡牌均为虚构。现实中订阅退款请遵守平台规则与消费者权益法。</p>
    </div>`;
  app.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => go('list', { mode: b.dataset.mode })));
}

function renderList(mode) {
  const levels = levelsOf(mode);
  const info = MODES[mode];
  app.innerHTML = `
    <div class="screen list-screen">
      <header class="topbar"><button class="icon-btn" data-act="home" aria-label="返回">‹</button><div><small>${esc(info.sub)}</small><h1>${esc(info.name)}</h1></div></header>
      <div class="level-grid">
        ${levels.map((lv, i) => {
          const id = idOf(mode, lv);
          const rec = save.get(mode, id);
          const title = mode === 'c' ? lv.title : lv.title;
          return `<button class="level-card" data-id="${esc(id)}"><span class="level-no">${String(i + 1).padStart(2, '0')}</span><span class="level-info"><strong>${esc(title)}</strong>${rec ? `<small>系统 ${rec.systemGrade} · 真相 ${rec.truthGrade}</small>` : '<small class="muted">未处理</small>'}</span></button>`;
        }).join('')}
      </div>
    </div>`;
  app.querySelector('[data-act="home"]').addEventListener('click', () => go('home', {}, true));
  app.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => go('play', { mode, id: b.dataset.id })));
}

function renderPlay(mode, id) {
  const levels = levelsOf(mode);
  const lv = levels.find((x) => idOf(mode, x) === id);
  if (!lv) return go('list', { mode }, true);
  if (mode === 'a') return renderCaseA(app, ctx, lv);
  if (mode === 'b') return renderDeskB(app, ctx, lv);
  return renderDeskC(app, ctx, lv);
}

function renderDisclaimer() {
  app.innerHTML = `
    <div class="screen center"><div class="notice">
      <div class="rating">12+</div>
      <h1>火眼金睛</h1>
      <p class="sub">A社临时审核员的赛博养家模拟器</p>
      <p><strong>本游戏不采集任何真实系统信息。所有设备档案均为虚构。如感不适可退出。</strong></p>
      <p class="muted">虚构黑色喜剧，含职场压迫、家庭人质隐喻、消费者权益冲突。所有诱饵、回执卡、话术卡均为抽象叙事卡牌，不映射任何现实操作。现实中订阅退款请遵守平台规则与消费者权益法。</p>
      <button class="btn primary big" data-act="ack">我已了解，开始轮岗</button>
    </div></div>`;
  app.querySelector('[data-act="ack"]').addEventListener('click', () => go('home', {}, true));
}

async function fetchJson(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`加载失败：${u}`);
  return r.json();
}

async function boot() {
  try {
    const [cardsC, platforms, rulesC, modeC, receipts, baits, rulesA, modeA, masks, rulesB, modeB] = await Promise.all([
      fetchJson('data/cards-c.json'), fetchJson('data/platforms.json'), fetchJson('data/rules-c.json'), fetchJson('data/mode-c.json'),
      fetchJson('data/receipts.json'), fetchJson('data/baits.json'), fetchJson('data/rules-a.json'), fetchJson('data/mode-a.json'),
      fetchJson('data/masks.json'), fetchJson('data/rules-b.json'), fetchJson('data/mode-b.json'),
    ]);
    D = {
      cards: cardsC.cards, platforms: platforms.platforms, rules: rulesC, defaults: modeC.defaults, modeC,
      receipts: receipts.receipts, baits: baits.baits, rulesA, defaultsA: modeA.defaults, modeA,
      masks: masks.masks, rulesB, defaultsB: modeB.defaults, modeB,
    };
  } catch (err) {
    app.innerHTML = `<p class="muted center">数据加载失败：${esc(err.message)}</p>`;
    return;
  }
  history.replaceState({ screen: 'disclaimer', params: {} }, '');
  renderDisclaimer();
}

boot();
