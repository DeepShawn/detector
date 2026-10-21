// 一局游戏：案情 → 计时 → 作答 → 判定 → 结算。

import { createMode } from './modes/index.js';
import { judge, computeStars } from './judge.js';
import { save } from './storage.js';
import { feedback } from './feedback.js';
import { shareResult } from './share.js';
import { el, esc, stars, toast, CATEGORY_LABELS } from './ui.js';

export class GameSession {
  constructor(level, root, { onExit, onRetry, onNext }) {
    this.level = level;
    this.root = root;
    this.handlers = { onExit, onRetry, onNext };
    this.elapsed = 0;
    this.running = false;
    this.finished = false;
    this.hintUsed = false;
    this.lastTick = 0;
    this.lastSecond = null;
    this.onVisibility = () => this.handleVisibility();
    this.build();
  }

  get remaining() {
    return Math.max(0, this.level.timeLimit - this.elapsed / 1000);
  }

  build() {
    const { level } = this;
    this.root.innerHTML = `
      <header class="play-head">
        <button class="icon-btn" data-act="exit" aria-label="返回">‹</button>
        <div class="play-title"><small>${esc(CATEGORY_LABELS[level.category] ?? '')}</small>${esc(level.title)}</div>
        <div class="timer" role="timer" aria-live="off"><b>${level.timeLimit}</b>s</div>
      </header>
      <div class="brief">
        <p>${esc(level.brief)}</p>
        <p class="question">🔍 ${esc(level.question)}</p>
        <p class="hint-text" hidden>💡 ${esc(level.hint)}</p>
      </div>
      <div class="board"></div>
      <footer class="play-foot">
        <button class="btn ghost" data-act="hint">💡 提示</button>
        <span class="counter"></span>
        <button class="btn primary" data-act="submit">提交答案</button>
      </footer>
      <div class="overlay intro">
        <div class="card">
          <div class="case-no">${esc(level.id.toUpperCase())}</div>
          <h2>${esc(level.title)}</h2>
          <p>${esc(level.brief)}</p>
          <p class="question">🔍 ${esc(level.question)}</p>
          <button class="btn primary big" data-act="start">开始调查 · ${level.timeLimit} 秒</button>
        </div>
      </div>`;

    this.timerEl = this.root.querySelector('.timer');
    this.counterEl = this.root.querySelector('.counter');
    this.mode = createMode(level, { onChange: () => this.updateCounter() });
    this.root.querySelector('.board').append(this.mode.el);
    this.updateCounter();

    this.root.addEventListener('click', (this.onClick = (e) => this.handleClick(e)));
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  handleClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const actions = {
      exit: () => this.handlers.onExit(),
      start: () => this.start(),
      hint: () => this.useHint(),
      submit: () => this.submit(),
      retry: () => this.handlers.onRetry(),
      next: () => this.handlers.onNext(),
      reveal: () => this.revealAnswer(),
      share: () => this.share(),
      toggle: () => this.root.querySelector('.result').classList.toggle('collapsed'),
    };
    actions[act]?.();
  }

  start() {
    this.root.querySelector('.intro').remove();
    feedback('tap');
    this.running = true;
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.tick(), 100);
  }

  tick() {
    if (!this.running) return;
    const now = performance.now();
    this.elapsed += now - this.lastTick;
    this.lastTick = now;
    const secs = Math.ceil(this.remaining);
    this.timerEl.querySelector('b').textContent = secs;
    this.timerEl.classList.toggle('urgent', secs <= 10);
    if (secs <= 10 && secs !== this.lastSecond && secs > 0) feedback('tick');
    this.lastSecond = secs;
    if (this.remaining <= 0) this.finish({ timeout: true });
  }

  // 切到后台时暂停计时，回来继续
  handleVisibility() {
    if (this.finished || !this.timer) return;
    this.running = !document.hidden;
    this.lastTick = performance.now();
  }

  updateCounter() {
    this.counterEl.textContent = this.mode.counter();
  }

  useHint() {
    if (this.hintUsed || this.finished) return;
    this.hintUsed = true;
    this.root.querySelector('.hint-text').hidden = false;
    this.root.querySelector('[data-act="hint"]').disabled = true;
    toast('已使用提示，本局最高 2 星');
    feedback('tap');
  }

  submit() {
    if (this.finished) return;
    if (this.mode.isEmpty()) {
      toast('先标记你觉得可疑的地方');
      return;
    }
    this.finish({ timeout: false });
  }

  finish({ timeout }) {
    this.finished = true;
    this.running = false;
    clearInterval(this.timer);
    this.mode.lock();

    const { level } = this;
    const remaining = Math.round(this.remaining);
    this.result = judge(level, this.mode.response());
    const correct = this.result.correct;
    const starCount = computeStars({ correct, remaining, timeLimit: level.timeLimit, hintUsed: this.hintUsed });
    this.outcome = { correct, timeout, remaining, used: level.timeLimit - remaining, stars: starCount };
    save.recordResult(level.id, { stars: starCount, remaining });

    feedback(correct ? 'correct' : 'wrong');
    if (correct) this.mode.reveal(this.result);
    this.showResult(correct);
  }

  revealAnswer() {
    this.mode.reveal(this.result);
    this.showResult(true);
  }

  explanations() {
    const { answer, content } = this.level;
    if (answer.kind === 'hotspots') {
      return answer.hotspots.map((h) => ({ title: h.label, text: h.explain }));
    }
    if (answer.kind === 'pick') {
      const items = content.kind === 'chat' ? content.messages : content.sections.flatMap((s) => s.items);
      return answer.ids.map((id) => {
        const item = items.find((it) => it.id === id);
        const who = item.from ?? item.who ?? '';
        return { title: `${who}${item.time ? ` ${item.time}` : ''}：${item.text}`, text: answer.explain?.[id] ?? '' };
      });
    }
    return [];
  }

  showResult(revealed) {
    this.root.querySelector('.result')?.remove();
    const { correct, timeout, used, stars: starCount } = this.outcome;
    const stamp = correct ? '破案！' : timeout ? '时间到' : '推理有误';
    const details = revealed
      ? `<ul class="explain">${this.explanations()
          .map((x) => `<li><strong>${esc(x.title)}</strong>${x.text ? `<span>${esc(x.text)}</span>` : ''}</li>`)
          .join('')}</ul>
         <p class="summary">${esc(this.level.summary)}</p>`
      : `<p class="summary">${timeout ? '时间用完了。' : '有标记不对，或者还漏了破绽。'}再仔细看看？</p>`;

    const buttons = correct
      ? `${this.handlers.onNext ? '<button class="btn primary" data-act="next">下一关</button>' : ''}
         <button class="btn" data-act="share">分享成绩</button>
         <button class="btn ghost" data-act="retry">再玩一次</button>`
      : revealed
        ? `<button class="btn primary" data-act="retry">重新挑战</button>`
        : `<button class="btn primary" data-act="retry">再试一次</button>
           <button class="btn ghost" data-act="reveal">揭晓答案</button>`;

    const sheet = el(
      'div',
      `result ${correct ? 'win' : 'lose'}`,
      `<button class="result-grip" data-act="toggle" aria-label="收起/展开结算">查看现场 ⌄</button>
       <div class="stamp">${stamp}</div>
       <div class="result-stars" aria-label="${starCount} 星">${stars(starCount)}</div>
       ${correct ? `<p class="result-time">用时 ${used} 秒${this.hintUsed ? ' · 使用了提示' : ''}</p>` : ''}
       ${details}
       <div class="result-actions">
         ${buttons}
         <button class="btn ghost" data-act="exit">返回列表</button>
       </div>`,
    );
    this.root.append(sheet);
  }

  async share() {
    const outcome = await shareResult(this.level, this.outcome);
    if (outcome === 'downloaded') toast('成绩卡已保存');
  }

  destroy() {
    clearInterval(this.timer);
    this.mode.destroy();
    this.root.removeEventListener('click', this.onClick);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

