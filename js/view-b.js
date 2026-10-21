// 模式B 伪装视图：逐个处理信息模块（跳过/填/遮挡卡）或直接举报诱饵。
import { createLure, respondModule, submitLure, previewEffects, allAnswered, settleB, B_RESOURCE_LABELS } from './engine-b.js';
import { save } from './storage.js';
import { esc, signed, el, toast, barHtml, familyHtml, gradeHtml, familyCommentsHtml } from './ui.js';

const BARS = ['disguise', 'consistency', 'alertness', 'systemTrust', 'familySafety', 'truth'];

export function renderDeskB(app, ctx, level) {
  const { data, go } = ctx;
  let run = createLure(level, data);
  let currentStep = 'lure';

  function moduleRow(m) {
    const chosen = run.responses[m.id];
    const opt = (action, label) => `<button class="opt ${chosen === action ? 'on' : ''}" data-mod="${m.id}" data-action="${action}">${esc(label)}</button>`;
    return `<div class="module">
      <strong>${esc(m.name)}</strong>
      <div class="opts">${opt('skip', '跳过')}${opt('fill', '直接填')}${level.masks.map((k) => opt(k, data.masks[k].name)).join('')}</div>
    </div>`;
  }

  function paint() {
    if (run.outcome) return paintSettle();
    const preview = previewEffects(run, level, data);
    app.innerHTML = `
      <div class="desk" data-mode="b">
        ${header()}
        <nav class="steps"><button data-step="lure" class="on">诱饵</button><button data-step="modules">模块</button><button data-step="submit">提交</button></nav>
        <section class="panel pane" data-pane="lure">
          <p class="brief sys">${esc(level.brief)}</p>
          <p class="question">🔍 ${esc(level.question)}</p>
          <div class="log">${run.log.map((l) => `<div class="msg sys"><p>${esc(l.text)}</p></div>`).join('')}</div>
        </section>
        <section class="panel pane" data-pane="modules">
          <h2>信息模块 <small class="muted">逐项处理</small></h2>
          ${level.modules.map(moduleRow).join('')}
        </section>
        <section class="panel pane" data-pane="submit">
          <h2>提交</h2>
          <div class="preview"><span>本次应对预估：</span>${['disguise', 'consistency', 'alertness'].map((k) => `<span class="fx ${k === 'alertness' ? 'down' : 'up'}">${esc(B_RESOURCE_LABELS[k])} ${signed(preview[k] ?? 0)}</span>`).join('')}</div>
          <div class="verdicts">
            <button class="btn primary" data-submit="submit" ${allAnswered(run, level) ? '' : 'disabled'}>按应对提交</button>
            <button class="btn" data-submit="report">识破 · 举报诱饵</button>
          </div>
          <p class="muted small">填得越全系统越信你，但你就离“帮凶”越近；识破举报才是正解。</p>
          ${BARS.map((k) => barHtml(k, run.res[k], B_RESOURCE_LABELS[k], data.rulesB.ranges[k])).join('')}
          ${familyHtml(run.res.familySafety)}
        </section>
      </div>`;
    wire();
    switchStep(currentStep);
  }

  function paintSettle() {
    const s = settleB(run, level, data);
    save.record('b', level.id, s);
    app.innerHTML = `
      <div class="screen settle">
        ${header(`结算：${esc(s.outcomeTitle)}`)}
        ${gradeHtml(s.systemGrade, s.truthGrade)}
        ${s.hiddenLine ? `<p class="hidden-line">🔓 隐藏线：「${esc(s.hiddenLine)}」</p>` : ''}
        ${s.recruited ? '<p class="sys brief">系统：恭喜晋升“纯度顾问”。从今天起，你来审你的家人。</p>' : ''}
        ${familyCommentsHtml(s.family)}
        <p class="anchor">真相提示：${esc(s.anchor)}</p>
        <div class="actions"><button class="btn primary" data-act="again">再来一次</button><button class="btn" data-act="back">返回伪装单列表</button></div>
      </div>`;
    app.querySelector('[data-act="again"]').addEventListener('click', () => { run = createLure(level, data); paint(); });
    app.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => go('list', { mode: 'b' })));
  }

  function header(title) {
    return `<header class="topbar"><button class="icon-btn" data-act="back" aria-label="返回">‹</button><div><small>模式B · 伪装者 · ${esc(level.id)}</small><h1>${esc(title ?? level.title)}</h1></div></header>`;
  }

  function wire() {
    app.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => go('list', { mode: 'b' })));
    app.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => { try { run = respondModule(run, b.dataset.mod, b.dataset.action, level, data); paint(); switchStep('modules'); } catch (e) { toast(e.message); } }));
    app.querySelectorAll('[data-submit]').forEach((b) => b.addEventListener('click', () => { try { run = submitLure(run, b.dataset.submit, level, data); paint(); } catch (e) { toast(e.message); } }));
    app.querySelectorAll('.steps button').forEach((b) => b.addEventListener('click', () => switchStep(b.dataset.step)));
  }

  function switchStep(step) {
    currentStep = step;
    app.querySelectorAll('.steps button').forEach((b) => b.classList.toggle('on', b.dataset.step === step));
    app.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === step));
  }

  paint();
  switchStep('lure');
}
