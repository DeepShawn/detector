// 点选模式：聊天记录（chat）与监控/证词对照（testimony）。玩家点选可疑条目。

import { el, esc, toast } from '../ui.js';
import { feedback } from '../feedback.js';

const AVATAR_COLORS = ['#e85d3a', '#3a8fe8', '#3ab07a', '#b05ce8', '#e8a93a', '#3ac4c4'];

function chatHtml(content) {
  const senders = [...new Set(content.messages.map((m) => m.from))];
  const items = content.messages
    .map((m) => {
      const color = AVATAR_COLORS[senders.indexOf(m.from) % AVATAR_COLORS.length];
      return `
      <div class="chat-row">
        <span class="avatar" style="background:${color}">${esc(m.from.slice(-1))}</span>
        <div class="chat-body">
          <div class="chat-meta">${esc(m.from)} <time>${esc(m.time)}</time></div>
          <button class="pickable bubble" data-id="${esc(m.id)}" aria-pressed="false">${esc(m.text)}</button>
        </div>
      </div>`;
    })
    .join('');
  return `
    <div class="chat">
      <div class="chat-head"><strong>${esc(content.group)}</strong><span>${esc(content.date ?? '')}</span></div>
      ${items}
    </div>`;
}

function testimonyHtml(content) {
  return content.sections
    .map((section) => {
      const rows = section.items
        .map((item) => {
          const inner =
            section.style === 'log'
              ? `<time>${esc(item.time)}</time><span>${esc(item.text)}</span>`
              : `<strong>${esc(item.who)}</strong><span>“${esc(item.text)}”</span>`;
          return section.selectable
            ? `<button class="pickable ${section.style}-item" data-id="${esc(item.id)}" aria-pressed="false">${inner}</button>`
            : `<div class="${section.style}-item">${inner}</div>`;
        })
        .join('');
      return `<section class="evidence ${section.style}"><h3>${esc(section.title)}</h3>${rows}</section>`;
    })
    .join('');
}

export function createPickMode(level, { onChange }) {
  const { content, answer } = level;
  const max = answer.maxPicks;
  const picks = [];
  let locked = false;

  const root = el('div', 'pick', content.kind === 'chat' ? chatHtml(content) : testimonyHtml(content));

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.pickable');
    if (!btn || locked) return;
    const id = btn.dataset.id;
    const at = picks.indexOf(id);
    if (at >= 0) {
      picks.splice(at, 1);
      feedback('tap');
    } else if (picks.length >= max) {
      toast(`最多选择 ${max} 项，再点一次可取消`);
      return;
    } else {
      picks.push(id);
      feedback('mark');
    }
    btn.setAttribute('aria-pressed', String(at < 0));
    onChange();
  });

  return {
    el: root,
    counter: () => `已选 ${picks.length}/${max}`,
    isEmpty: () => picks.length === 0,
    response: () => ({ picks: [...picks] }),

    lock() {
      locked = true;
    },

    reveal(result) {
      locked = true;
      root.classList.add('revealed');
      for (const btn of root.querySelectorAll('.pickable')) {
        const id = btn.dataset.id;
        btn.classList.toggle('is-answer', answer.ids.includes(id));
        btn.classList.toggle('is-wrong', result.wrong.includes(id));
      }
    },

    destroy() {},
  };
}
