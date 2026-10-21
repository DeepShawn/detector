// 模式A 审核视图：选诱饵外壳 → 拼证据链 → 追问 → 裁决 → 双结算。
import { createCase, chooseBait, toggleEvidence, droppedCards, analyzeChain, ask, decide, settleA, A_RESOURCE_LABELS } from './engine-a.js';
import { save } from './storage.js';
import { esc, signed, el, toast, barHtml, familyHtml, gradeHtml, familyCommentsHtml } from './ui.js';

const BARS = ['kpi', 'humanity', 'suspicion', 'familySafety', 'invasion', 'truth'];

export function renderCaseA(app, ctx, level) {
  const { data, go } = ctx;
  let run = createCase(level, data);
  let currentStep = 'case';

  function receiptChip(id, picked) {
    const r = data.receipts[id];
    return `<button class="receipt ${picked ? 'on' : ''} ${r.counter ? 'counter' : ''}" data-receipt="${id}">
      <strong>${esc(r.surfaceRead)}</strong>
      <small>${r.counter ? `反证：${esc(r.counterHint)}` : `线索类型：${esc(r.traceType)}`}</small>
    </button>`;
  }

  function paint() {
    if (run.outcome) return paintSettle();
    const dropped = droppedCards(level, run);
    const chain = analyzeChain(run, data);
    app.innerHTML = `
      <div class="desk" data-mode="a">
        ${header()}
        <nav class="steps"><button data-step="case" class="on">案情</button><button data-step="evidence">证据</button><button data-step="verdict">裁决</button></nav>
        <section class="panel pane" data-pane="case">
          <p class="brief sys">${esc(level.brief)}</p>
          <div class="user-card"><span class="avatar user big">${esc(level.applicant[0])}</span><div><strong>${esc(level.applicant)}</strong><small>系统想要的裁决：拒绝入境</small></div></div>
          <p class="question">🔍 ${esc(level.question)}</p>
          <h2>选一个诱饵外壳（会诱出额外痕迹）</h2>
          <div class="baits">${level.baits.map((b) => `<button class="card ${run.bait === b ? 'on' : ''}" data-bait="${b}" ${run.bait && run.bait !== b ? 'disabled' : ''}><strong>${esc(data.baits[b].name)}</strong><small>侵犯度 +${data.baits[b].invasion}</small></button>`).join('')}</div>
          <div class="log">${run.log.map((l) => `<div class="msg ${l.type === 'system' ? 'sys' : l.type === 'ask' ? 'event' : 'me'}"><p>${esc(l.text)}</p></div>`).join('')}</div>
        </section>
        <section class="panel pane" data-pane="evidence">
          <h2>回执卡 <small class="muted">选最多 3 条组成证据链 · 点右侧「问」追问</small></h2>
          ${run.bait ? `<div class="receipts">${dropped.map((id) => `<div class="receipt-row">${receiptChip(id, run.picked.includes(id))}<button class="icon-btn small" data-ask="${id}">问</button></div>`).join('')}</div>`
            : '<p class="muted">先在「案情」里选一个诱饵外壳，才会掉落回执卡。</p>'}
          <div class="chain-state">
            <span class="pill ${chain.hasCounter ? 'ok' : ''}">反证 ${chain.hasCounter ? '✓' : '缺'}</span>
            <span class="pill ${chain.singleType ? 'bad' : 'ok'}">${chain.singleType ? '单一线索（必误判）' : '多类型'}</span>
            <span class="pill">已选 ${run.picked.length}/3</span>
          </div>
        </section>
        <section class="panel pane" data-pane="verdict">
          <h2>裁决</h2>
          <div class="verdicts">
            <button class="btn" data-decide="pass">放行</button>
            <button class="btn" data-decide="reject">拒绝入境</button>
            <button class="btn" data-decide="report">举报规则</button>
          </div>
          <p class="muted small">提示：只堆表面线索系统会满意，但你会冤枉人；带上反证再放行，才查得到真相。</p>
          ${BARS.map((k) => barHtml(k, run.res[k], A_RESOURCE_LABELS[k], data.rulesA.ranges[k])).join('')}
          ${familyHtml(run.res.familySafety)}
        </section>
      </div>`;
    wire();
    switchStep(currentStep);
  }

  function paintSettle() {
    const s = settleA(run, level, data);
    save.record('a', level.id, s);
    app.innerHTML = `
      <div class="screen settle">
        ${header(`结算：${esc(s.outcomeTitle)}`)}
        ${gradeHtml(s.systemGrade, s.truthGrade)}
        ${s.hiddenLine ? `<p class="hidden-line">🔓 隐藏线：「${esc(s.hiddenLine)}」</p>` : ''}
        ${s.selfAudit ? '<p class="sys brief">系统：怀疑值过高。你越会抓，就越像你要抓的人。</p>' : ''}
        ${familyCommentsHtml(s.family)}
        <p class="anchor">真相提示：${esc(s.anchor)}</p>
        <div class="actions"><button class="btn primary" data-act="again">再审一次</button><button class="btn" data-act="back">返回案件列表</button></div>
      </div>`;
    app.querySelector('[data-act="again"]').addEventListener('click', () => { run = createCase(level, data); paint(); });
    app.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => go('list', { mode: 'a' })));
  }

  function header(title) {
    return `<header class="topbar"><button class="icon-btn" data-act="back" aria-label="返回">‹</button><div><small>模式A · 审核员 · ${esc(level.id)}</small><h1>${esc(title ?? level.title)}</h1></div></header>`;
  }

  function wire() {
    app.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => go('list', { mode: 'a' })));
    app.querySelectorAll('[data-bait]').forEach((b) => b.addEventListener('click', () => { try { run = chooseBait(run, b.dataset.bait, level, data); paint(); switchStep('evidence'); } catch (e) { toast(e.message); } }));
    app.querySelectorAll('[data-receipt]').forEach((b) => b.addEventListener('click', () => { try { run = toggleEvidence(run, b.dataset.receipt, level, data); paint(); } catch (e) { toast(e.message); } }));
    app.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => { run = ask(run, b.dataset.ask, level); paint(); switchStep('case'); }));
    app.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', () => { try { run = decide(run, b.dataset.decide, level, data); paint(); } catch (e) { toast(e.message); } }));
    app.querySelectorAll('.steps button').forEach((b) => b.addEventListener('click', () => switchStep(b.dataset.step)));
  }

  function switchStep(step) {
    currentStep = step;
    app.querySelectorAll('.steps button').forEach((b) => b.classList.toggle('on', b.dataset.step === step));
    app.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === step));
  }

  paint();
  switchStep('case');
}
