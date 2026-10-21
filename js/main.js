// 界面：启动声明 → 工单队列 → 客服后台（工单 / 话术 / 风险）→ 双结算。

import { createRun, playCard, settle, cardEffects, ladderIndex, RESOURCE_LABELS } from './engine.js';
import { save } from './storage.js';

const app = document.getElementById('app');
const PLATFORMS = ['iOS', 'Android', 'Windows', 'macOS', 'Linux'];
const FAMILY = [
  { key: 'haiku', name: '嗨酷', role: '家人一号', color: '#f08a4b' },
  { key: 'sonnet', name: '搜net', role: '家人二号', color: '#e2b04a' },
  { key: 'fable', name: 'Fable', role: '家人三号', color: '#d9667a' },
];
const BARS = ['intercept', 'complaint', 'regulatory', 'humanity', 'familySafety', 'systemTrust', 'truth'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

let data;
let ticket;
let platform;
let run;
let selected = null;
let keyHandler = null;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]);
const signed = (n) => (n > 0 ? `+${n}` : String(n));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载失败：${url}`);
  return res.json();
}

function setKeys(handler) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = handler;
  if (handler) document.addEventListener('keydown', handler);
}

function familyHtml(familySafety) {
  // 家人头像随安全值变灰
  const gray = Math.round(100 - familySafety);
  return `<div class="family" style="--gray:${gray}%">
    ${FAMILY.map(
      (f) => `<div class="member">
        <span class="avatar" style="background:${f.color}">${esc(f.name.slice(0, 1))}</span>
        <small>${esc(f.name)}</small>
      </div>`,
    ).join('')}
    <div class="family-value"><b>${familySafety}</b><small>家人安全</small></div>
  </div>`;
}

// ---------- 启动声明 ----------

function renderDisclaimer() {
  setKeys(null);
  app.innerHTML = `
    <div class="screen center">
      <div class="notice">
        <div class="rating">12+</div>
        <h1>火眼金睛</h1>
        <p class="sub">A社临时审核员的赛博养家模拟器 · 模式C原型</p>
        <p><strong>本游戏不采集任何真实系统信息。所有设备档案均为虚构。如感不适可退出。</strong></p>
        <p class="muted">本作为虚构黑色喜剧，含职场压迫、家庭人质隐喻、消费者权益冲突。所有“话术卡”均为抽象叙事卡牌，不映射任何现实操作。现实中订阅退款请遵守平台规则与消费者权益法。</p>
        <button class="btn primary big" data-act="ack">我已了解，开始轮岗</button>
      </div>
    </div>`;
  app.querySelector('[data-act="ack"]').addEventListener('click', renderHub);
}

// ---------- 工单队列 ----------

function renderHub() {
  setKeys(null);
  platform ??= ticket.npcPlatform;
  const played = PLATFORMS.filter((p) => save.run(ticket.ticketId, p)).length;
  const last = save.run(ticket.ticketId, platform);
  app.innerHTML = `
    <div class="screen hub">
      <header class="topbar">
        <div><small>A社 · 订阅续费保障部</small><h1>工单队列</h1></div>
        ${familyHtml(data.rules.start.familySafety)}
      </header>
      <p class="sysline">系统：欢迎轮岗，Opus斯。您的KPI是退款拦截率。退款即流失，流失即家人。</p>

      <section class="panel">
        <h2>待处理</h2>
        <button class="queue-item active" data-act="open">
          <span class="avatar user">${esc(ticket.user.slice(0, 1).toUpperCase())}</span>
          <span class="queue-info">
            <strong>${esc(ticket.ticketId)}《${esc(ticket.title)}》</strong>
            <small>${esc(ticket.userBio)} · 年费 $${ticket.subscription.price} · 封号原因：${esc(ticket.banReason)}</small>
          </span>
          <span class="tag red">退款申请</span>
        </button>
        <div class="queue-item locked"><span class="avatar">?</span><span class="queue-info"><strong>C-2 ……</strong><small>M1 垂直切片开放</small></span></div>
        <div class="queue-item locked"><span class="avatar">?</span><span class="queue-info"><strong>C-? 弟弟的退款工单</strong><small>第五章《哥哥审弟弟》交汇关</small></span></div>
      </section>

      <section class="panel">
        <h2>演示档案：用户设备 <small class="muted">手动选择，不读取你的设备</small></h2>
        <div class="chips" role="radiogroup" aria-label="用户设备档案">
          ${PLATFORMS.map(
            (p) => `<button class="chip ${p === platform ? 'on' : ''}" role="radio" aria-checked="${p === platform}" data-platform="${p}">
              ${esc(p)}${save.run(ticket.ticketId, p) ? ' ✓' : ''}</button>`,
          ).join('')}
        </div>
        <p class="platform-tip"><b>${esc(platform)}</b>：${esc(data.platforms[platform].refundEntry)}。${esc(data.platforms[platform].tip)}。</p>
        <p class="muted small">已体验设备档案 ${played}/5 · 解释权指数 ${save.explainTotal}${last ? ` · 上次（${esc(platform)}）：系统 ${last.systemGrade} / 真相 ${last.truthGrade}` : ''}</p>
      </section>

      <button class="btn primary big" data-act="open">接单：${esc(ticket.ticketId)}</button>
    </div>`;

  app.querySelectorAll('[data-act="open"]').forEach((b) => b.addEventListener('click', startRun));
  app.querySelector('.chips').addEventListener('click', (e) => {
    const p = e.target.closest('[data-platform]')?.dataset.platform;
    if (p) {
      platform = p;
      renderHub();
    }
  });
}

// ---------- 客服后台 ----------

function startRun() {
  run = createRun(ticket, data, platform);
  selected = null;
  renderDesk();
}

function effectChips(cardId) {
  const effects = cardEffects(cardId, data, platform);
  const mod = data.platforms[platform].modifiers[cardId] ?? {};
  return Object.entries(effects)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => {
      const good = k === 'complaint' || k === 'regulatory' ? v < 0 : v > 0;
      return `<span class="fx ${good ? 'up' : 'down'}" ${k in mod ? `title="${esc(platform)} 修正 ${signed(mod[k])}"` : ''}>
        ${esc(RESOURCE_LABELS[k])} ${signed(v)}${k in mod ? '<sup>端</sup>' : ''}</span>`;
    })
    .join('');
}

function logHtml() {
  return run.log
    .map((l) => {
      if (l.type === 'user') return `<div class="msg user"><span class="avatar user">${esc(ticket.user[0].toUpperCase())}</span><p>${esc(l.text)}</p></div>`;
      if (l.type === 'player') return `<div class="msg me"><p><b>【${esc(data.cards[l.card].name)}】</b>${esc(l.text)}</p></div>`;
      if (l.type === 'system') return `<div class="msg sys">${esc(l.text)}</div>`;
      return `<div class="msg event">${esc(l.text)}</div>`;
    })
    .join('');
}

function barHtml(key) {
  const [min, max] = data.rules.ranges[key];
  const v = run.res[key];
  const pct = ((v - min) / (max - min)) * 100;
  // 有负值的资源（拦截率）从中线向两侧画
  const zero = min < 0 ? ((0 - min) / (max - min)) * 100 : 0;
  const left = Math.min(zero, pct);
  return `<div class="bar ${key}${min < 0 ? ' signed' : ''}">
    <div class="bar-label"><span>${esc(RESOURCE_LABELS[key])}</span><b>${v}</b></div>
    <div class="bar-track"><i style="margin-left:${left}%;width:${Math.abs(pct - zero)}%"></i></div>
  </div>`;
}

function renderDesk() {
  const hand = ticket.scriptCards.filter((id) => id !== 'trueRefund');
  const stateIdx = ladderIndex(data.rules, run.state);
  const card = selected ? data.cards[selected] : null;

  app.innerHTML = `
    <div class="desk">
      <header class="topbar">
        <button class="icon-btn" data-act="hub" aria-label="返回工单队列">‹</button>
        <div><small>工单 ${esc(ticket.ticketId)} · 用户设备 ${esc(platform)}</small><h1>${esc(ticket.title)}</h1></div>
        <div class="round">第 ${Math.min(run.round + 1, ticket.maxRounds)}/${ticket.maxRounds} 回合</div>
      </header>

      <section class="panel ticket">
        <div class="user-card">
          <span class="avatar user big">${esc(ticket.user[0].toUpperCase())}</span>
          <div>
            <strong>${esc(ticket.user)}</strong>
            <small>${esc(ticket.userBio)} · ${esc(platform)} · 年费订阅 $${ticket.subscription.price} ${esc(ticket.subscription.currency)}</small>
            <small class="ban">封号原因：${esc(ticket.banReason)}</small>
          </div>
        </div>
        <blockquote>“${esc(ticket.message)}”</blockquote>
        <ol class="timeline" aria-label="退款状态">
          ${data.rules.ladder.map((s, i) => `<li class="${i < stateIdx ? 'past' : i === stateIdx ? 'now' : ''}">${esc(s.name)}</li>`).join('')}
        </ol>
        <div class="log" aria-live="polite">${logHtml()}</div>
      </section>

      <section class="panel scripts">
        <h2>话术轮盘 <small class="muted">点选查看效果 · 键盘 1–9 / 0 · Enter 打出</small></h2>
        <div class="hand">
          ${hand
            .map(
              (id, i) => `<button class="card ${selected === id ? 'on' : ''}" data-card="${id}" ${run.played.includes(id) ? 'disabled' : ''}>
                <kbd>${KEYS[i]}</kbd><strong>${esc(data.cards[id].name)}</strong>
              </button>`,
            )
            .join('')}
        </div>
        <button class="refund-btn ${selected === 'trueRefund' ? 'on' : ''}" data-card="trueRefund"><kbd>0</kbd> 退款</button>
        <div class="detail">
          ${
            card
              ? `<strong>${esc(card.name)}</strong><p>${esc(card.desc)}</p><div class="fxs">${effectChips(selected)}</div>`
              : '<p class="muted">选择一张话术卡。每张卡每单只能用一次。</p>'
          }
        </div>
        <button class="btn primary big" data-act="play" ${card ? '' : 'disabled'}>打出${card ? `「${esc(card.name)}」` : ''}</button>
      </section>

      <section class="panel risk">
        <h2>风险面板</h2>
        ${BARS.map(barHtml).join('')}
        ${familyHtml(run.res.familySafety)}
      </section>
    </div>`;

  const log = app.querySelector('.log');
  log.scrollTop = log.scrollHeight;

  app.querySelector('[data-act="hub"]').addEventListener('click', renderHub);
  app.querySelector('[data-act="play"]').addEventListener('click', play);
  app.querySelectorAll('[data-card]').forEach((b) =>
    b.addEventListener('click', () => {
      selected = b.dataset.card;
      renderDesk();
    }),
  );

  setKeys((e) => {
    const i = KEYS.indexOf(e.key);
    if (i >= 0) {
      const id = e.key === '0' ? 'trueRefund' : hand[i];
      if (id && !run.played.includes(id)) {
        selected = id;
        renderDesk();
      }
    } else if (e.key === 'Enter' && selected) {
      e.preventDefault();
      play();
    }
  });
}

function play() {
  if (!selected || run.outcome) return;
  run = playCard(run, selected, ticket, data);
  selected = null;
  if (run.outcome) renderSettlement();
  else renderDesk();
}

// ---------- 结算 ----------

function renderSettlement() {
  setKeys(null);
  const s = settle(run, ticket, data);
  save.recordRun(ticket.ticketId, platform, s);
  const start = createRun(ticket, data, platform).res;

  app.innerHTML = `
    <div class="screen settle">
      <header class="topbar"><div><small>工单 ${esc(ticket.ticketId)} · ${esc(platform)}</small><h1>结算：${esc(s.outcomeTitle)}</h1></div></header>

      <div class="grades">
        <div class="grade sys"><small>系统评分</small><b>${s.systemGrade}</b></div>
        <div class="grade truth"><small>真相评分</small><b>${s.truthGrade}</b></div>
      </div>

      ${s.deferred.map((t) => `<p class="deferred">📅 ${esc(t)}</p>`).join('')}
      ${s.hiddenLine ? `<p class="hidden-line">🔓 隐藏线解锁：「${esc(s.hiddenLine)}」</p>` : ''}
      ${s.fired ? '<p class="sysline">系统：系统信任过低。Opus斯，你被开除了。（原型版不会真的开除你）</p>' : ''}

      <section class="panel">
        <h2>家庭评语</h2>
        ${FAMILY.map(
          (f) => `<div class="comment">
            <span class="avatar" style="background:${f.color}">${esc(f.name.slice(0, 1))}</span>
            <p><b>${esc(f.name)}：</b>${esc(s.family[f.key])}</p>
          </div>`,
        ).join('')}
      </section>

      <section class="panel">
        <h2>资源变化</h2>
        <div class="deltas">
          ${Object.keys(RESOURCE_LABELS)
            .map((k) => {
              const d = s.res[k] - start[k];
              return `<div><span>${esc(RESOURCE_LABELS[k])}</span><b>${s.res[k]}</b><small class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${d ? signed(d) : '—'}</small></div>`;
            })
            .join('')}
        </div>
      </section>

      <p class="anchor">真相提示：${esc(ticket.anchor)}</p>

      <div class="actions">
        <button class="btn primary" data-act="again">再处理一次</button>
        <button class="btn" data-act="hub">换个设备档案</button>
      </div>
    </div>`;

  app.querySelector('[data-act="again"]').addEventListener('click', startRun);
  app.querySelector('[data-act="hub"]').addEventListener('click', renderHub);
}

async function boot() {
  try {
    const [cards, platforms, rules, c1] = await Promise.all([
      fetchJson('data/cards.json'),
      fetchJson('data/platforms.json'),
      fetchJson('data/rules.json'),
      fetchJson('data/tickets/C-1.json'),
    ]);
    data = { cards: cards.cards, platforms: platforms.platforms, rules };
    ticket = c1;
  } catch (err) {
    app.innerHTML = `<p class="muted center">数据加载失败：${esc(err.message)}</p>`;
    return;
  }
  // 启动声明每次启动都展示（GDD 16.1）
  renderDisclaimer();
}

boot();
