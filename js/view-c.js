// 模式C 客服后台视图。手机：分步标签页；桌面：三栏并列。
import { createRun, playCard, settle, cardEffects, ladderIndex, RESOURCE_LABELS } from './engine.js';
import { save } from './storage.js';
import { esc, signed, el, toast, barHtml, familyHtml, gradeHtml, familyCommentsHtml } from './ui.js';

const BARS = ['intercept', 'complaint', 'regulatory', 'humanity', 'familySafety', 'systemTrust', 'truth'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function renderDeskC(app, ctx, ticket) {
  const { data, go } = ctx;
  const platform = ticket.npcPlatform;
  let run = createRun(ticket, data, platform);
  let selected = null;
  let currentStep = 'ticket';

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

  function effectChips(cardId) {
    const effects = cardEffects(cardId, data, platform);
    const mod = data.platforms[platform].modifiers[cardId] ?? {};
    return Object.entries(effects)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => {
        const good = k === 'complaint' || k === 'regulatory' ? v < 0 : v > 0;
        return `<span class="fx ${good ? 'up' : 'down'}">${esc(RESOURCE_LABELS[k])} ${signed(v)}${k in mod ? '<sup>端</sup>' : ''}</span>`;
      })
      .join('');
  }

  function paint() {
    if (run.outcome) return paintSettle();
    const hand = data.defaults.scriptCards.filter((id) => id !== 'trueRefund');
    const stateIdx = ladderIndex(data.rules, run.state);
    const card = selected ? data.cards[selected] : null;
    app.innerHTML = `
      <div class="desk" data-mode="c">
        ${header()}
        <nav class="steps"><button data-step="ticket" class="on">工单</button><button data-step="scripts">话术</button><button data-step="risk">风险</button></nav>
        <section class="panel pane" data-pane="ticket">
          <div class="user-card"><span class="avatar user big">${esc(ticket.user[0].toUpperCase())}</span>
            <div><strong>${esc(ticket.user)}</strong><small>${esc(ticket.userBio)} · ${esc(platform)} · $${ticket.subscription.price} ${esc(ticket.subscription.currency)}</small><small class="ban">封号原因：${esc(ticket.banReason)}</small></div></div>
          <blockquote>${esc(ticket.message)}</blockquote>
          <ol class="timeline">${data.rules.ladder.map((s, i) => `<li class="${i < stateIdx ? 'past' : i === stateIdx ? 'now' : ''}">${esc(s.name)}</li>`).join('')}</ol>
          <div class="log">${logHtml()}</div>
        </section>
        <section class="panel pane" data-pane="scripts">
          <h2>话术轮盘 <small class="muted">键盘 1–9 / 0 · Enter 打出</small></h2>
          <div class="hand">${hand.map((id, i) => `<button class="card ${selected === id ? 'on' : ''}" data-card="${id}" ${run.played.includes(id) ? 'disabled' : ''}><kbd>${KEYS[i]}</kbd><strong>${esc(data.cards[id].name)}</strong></button>`).join('')}</div>
          <button class="refund-btn ${selected === 'trueRefund' ? 'on' : ''}" data-card="trueRefund"><kbd>0</kbd> 退款</button>
          <div class="detail">${card ? `<strong>${esc(card.name)}</strong><p>${esc(card.desc)}</p><div class="fxs">${effectChips(selected)}</div>` : '<p class="muted">选择一张话术卡。每张每单限用一次。</p>'}</div>
          <button class="btn primary big" data-act="play" ${card ? '' : 'disabled'}>打出${card ? `「${esc(card.name)}」` : ''}</button>
        </section>
        <section class="panel pane" data-pane="risk"><h2>风险面板 <span class="round">第 ${Math.min(run.round + 1, ticket.maxRounds ?? 3)}/${ticket.maxRounds ?? 3} 回合</span></h2>${BARS.map((k) => barHtml(k, run.res[k], RESOURCE_LABELS[k], data.rules.ranges[k])).join('')}${familyHtml(run.res.familySafety)}</section>
      </div>`;
    wire();
    switchStep(currentStep);
    const log = app.querySelector('.log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function paintSettle() {
    const s = settle(run, ticket, data);
    save.record('c', ticket.ticketId, s);
    const start = createRun(ticket, data, platform).res;
    app.innerHTML = `
      <div class="screen settle">
        ${header(`结算：${esc(s.outcomeTitle)}`)}
        ${gradeHtml(s.systemGrade, s.truthGrade)}
        ${s.deferred.map((t) => `<p class="deferred">📅 ${esc(t)}</p>`).join('')}
        ${s.hiddenLine ? `<p class="hidden-line">🔓 隐藏线：「${esc(s.hiddenLine)}」</p>` : ''}
        ${familyCommentsHtml(s.family)}
        <section class="panel"><h2>资源变化</h2><div class="deltas">${Object.keys(RESOURCE_LABELS).map((k) => { const d = s.res[k] - start[k]; return `<div><span>${esc(RESOURCE_LABELS[k])}</span><b>${s.res[k]}</b><small class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${d ? signed(d) : '—'}</small></div>`; }).join('')}</div></section>
        <p class="anchor">真相提示：${esc(ticket.anchor ?? data.defaults.anchor)}</p>
        <div class="actions"><button class="btn primary" data-act="again">再处理一次</button><button class="btn" data-act="back">返回工单队列</button></div>
      </div>`;
    app.querySelector('[data-act="again"]').addEventListener('click', () => { run = createRun(ticket, data, platform); selected = null; paint(); });
    app.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => go('list', { mode: 'c' })));
  }

  function header(title) {
    return `<header class="topbar"><button class="icon-btn" data-act="back" aria-label="返回">‹</button><div><small>工单 ${esc(ticket.ticketId)} · ${esc(platform)}</small><h1>${esc(title ?? ticket.title)}</h1></div></header>`;
  }

  function play() {
    if (!selected || run.outcome) return;
    run = playCard(run, selected, ticket, data);
    selected = null;
    paint();
  }

  function wire() {
    app.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => go('list', { mode: 'c' })));
    app.querySelector('[data-act="play"]')?.addEventListener('click', play);
    app.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.card; paint(); }));
    app.querySelectorAll('.steps button').forEach((b) => b.addEventListener('click', () => switchStep(b.dataset.step)));
  }

  function switchStep(step) {
    currentStep = step;
    app.querySelectorAll('.steps button').forEach((b) => b.classList.toggle('on', b.dataset.step === step));
    app.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === step));
  }

  ctx.onKey((e) => {
    if (run.outcome) return;
    const hand = data.defaults.scriptCards.filter((id) => id !== 'trueRefund');
    const i = KEYS.indexOf(e.key);
    if (i >= 0) { const id = e.key === '0' ? 'trueRefund' : hand[i]; if (id && !run.played.includes(id)) { selected = id; paint(); } }
    else if (e.key === 'Enter' && selected) { e.preventDefault(); play(); }
  });

  paint();
  switchStep('ticket');
}
