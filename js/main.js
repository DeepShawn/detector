// 入口：加载关卡、页面路由（history 状态，支持安卓返回键）。

import { save } from './storage.js';
import { loadAllLevels } from './levels.js';
import { feedback } from './feedback.js';
import { GameSession } from './play.js';
import { el, esc, stars, toast, CATEGORY_LABELS } from './ui.js';

const app = document.getElementById('app');
let levels = [];
let session = null;

const isSolved = (level) => (save.record(level.id)?.stars ?? 0) > 0;
const isUnlocked = (index) => index === 0 || isSolved(levels[index - 1]);

function go(name, params = {}, { replace = false } = {}) {
  const depth = (history.state?.depth ?? 0) + (replace ? 0 : 1);
  const state = { name, params, depth };
  if (replace) history.replaceState(state, '');
  else history.pushState(state, '');
  render(state);
}

function back() {
  if ((history.state?.depth ?? 0) > 0) history.back();
  else go('home', {}, { replace: true });
}

window.addEventListener('popstate', (e) => render(e.state ?? { name: 'home', params: {}, depth: 0 }));

const screens = {
  home: renderHome,
  levels: renderLevels,
  play: renderPlay,
  archive: renderArchive,
  settings: renderSettings,
};

function render({ name, params }) {
  session?.destroy();
  session = null;
  app.replaceChildren();
  app.dataset.screen = name;
  (screens[name] ?? renderHome)(params ?? {});
  window.scrollTo(0, 0);
}

function screenHeader(title) {
  return `<header class="screen-head">
    <button class="icon-btn" data-nav="back" aria-label="返回">‹</button>
    <h1>${esc(title)}</h1>
  </header>`;
}

function renderHome() {
  const solved = levels.filter(isSolved).length;
  const nextIndex = levels.findIndex((lv, i) => isUnlocked(i) && !isSolved(lv));
  const continueLabel = solved === 0 ? '开始调查' : nextIndex >= 0 ? '继续调查' : '全部破案！';
  app.innerHTML = `
    <div class="home">
      <div class="logo" aria-hidden="true">🕵️</div>
      <h1>一分钟谜案</h1>
      <p class="slogan">你能 60 秒看出谁在说谎吗？</p>
      <div class="stats">
        <div><b>${solved}/${levels.length}</b><span>已破案件</span></div>
        <div><b>${save.totalStars()}/${levels.length * 3}</b><span>线索碎片</span></div>
      </div>
      <nav class="menu">
        <button class="btn primary big" data-nav="continue" ${nextIndex < 0 && solved > 0 ? 'disabled' : ''}>${continueLabel}</button>
        <button class="btn big" data-nav="levels">案件列表</button>
        <button class="btn big" data-nav="archive">案件档案</button>
        <button class="btn ghost" data-nav="settings">设置</button>
      </nav>
    </div>`;
  app.querySelector('[data-nav="continue"]').addEventListener('click', () => {
    if (nextIndex >= 0) go('play', { id: levels[nextIndex].id });
  });
}

function renderLevels() {
  const cards = levels
    .map((lv, i) => {
      const rec = save.record(lv.id);
      const unlocked = isUnlocked(i);
      return `
      <button class="level-card ${unlocked ? '' : 'locked'}" data-play="${esc(lv.id)}" ${unlocked ? '' : 'disabled'}>
        <span class="level-no">${String(i + 1).padStart(2, '0')}</span>
        <span class="level-info">
          <strong>${unlocked ? esc(lv.title) : '未解锁'}</strong>
          <small>${esc(CATEGORY_LABELS[lv.category] ?? '')} · ${'◆'.repeat(lv.difficulty)}</small>
        </span>
        <span class="level-stars">${unlocked ? stars(rec?.stars ?? 0) : '🔒'}</span>
      </button>`;
    })
    .join('');
  app.innerHTML = `${screenHeader('案件列表')}<div class="level-list">${cards}</div>
    <p class="note">破解上一案即可解锁下一案</p>`;
  app.querySelector('.level-list').addEventListener('click', (e) => {
    const id = e.target.closest('[data-play]')?.dataset.play;
    if (id) go('play', { id });
  });
}

function renderPlay({ id }) {
  const index = levels.findIndex((lv) => lv.id === id);
  if (index < 0 || !isUnlocked(index)) {
    go('levels', {}, { replace: true });
    return;
  }
  const level = levels[index];
  const root = el('div', 'play');
  app.append(root);
  session = new GameSession(level, root, {
    onExit: back,
    onRetry: () => go('play', { id }, { replace: true }),
    onNext: levels[index + 1] ? () => go('play', { id: levels[index + 1].id }, { replace: true }) : null,
  });
}

function renderArchive() {
  const entries = levels
    .map((lv, i) => {
      const rec = save.record(lv.id);
      if (!isSolved(lv)) {
        return `<li class="archive-item sealed"><span class="level-no">${String(i + 1).padStart(2, '0')}</span><div><strong>？？？</strong><p>尚未破案</p></div></li>`;
      }
      return `<li class="archive-item">
        <span class="level-no">${String(i + 1).padStart(2, '0')}</span>
        <div>
          <strong>${esc(lv.title)} <em>${stars(rec.stars)}</em></strong>
          <p>${esc(lv.summary)}</p>
          <small>最佳：剩余 ${rec.bestRemaining} 秒 · 挑战 ${rec.attempts} 次</small>
        </div>
      </li>`;
    })
    .join('');
  app.innerHTML = `${screenHeader('案件档案')}<ul class="archive">${entries}</ul>`;
}

function renderSettings() {
  const { sound, vibrate } = save.settings;
  app.innerHTML = `${screenHeader('设置')}
    <div class="settings">
      <label class="setting"><span>音效</span><input type="checkbox" data-setting="sound" ${sound ? 'checked' : ''}></label>
      <label class="setting"><span>震动</span><input type="checkbox" data-setting="vibrate" ${vibrate ? 'checked' : ''}></label>
      <button class="btn danger" data-reset>重置所有进度</button>
      <p class="note">一分钟谜案 · 原型版 v0.1 · 完全离线</p>
    </div>`;
  app.querySelector('.settings').addEventListener('change', (e) => {
    const key = e.target.dataset.setting;
    if (!key) return;
    save.setSetting(key, e.target.checked);
    feedback('tap');
  });
  app.querySelector('[data-reset]').addEventListener('click', () => {
    if (confirm('确定要清空所有案件进度吗？此操作无法撤销。')) {
      save.resetProgress();
      toast('进度已重置');
    }
  });
}

app.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]')?.dataset.nav;
  if (!nav || nav === 'continue') return;
  feedback('tap');
  if (nav === 'back') back();
  else go(nav);
});

async function boot() {
  try {
    levels = await loadAllLevels();
  } catch (err) {
    app.innerHTML = `<p class="note">关卡加载失败：${esc(err.message)}</p>`;
    return;
  }
  const initial = history.state ?? { name: 'home', params: {}, depth: 0 };
  history.replaceState(initial, '');
  render(initial);
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
