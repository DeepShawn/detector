// 排序推理：按住 ≡ 拖动，或用 ↑↓ 按钮调整顺序。

import { el, esc } from '../ui.js';
import { feedback } from '../feedback.js';

export function createOrderMode(level, { onChange }) {
  const { items, initialOrder } = level.content;
  const byId = new Map(items.map((it) => [it.id, it]));
  let locked = false;

  const root = el('div', 'order');
  const list = el('ol', 'order-list');
  root.append(list);

  for (const id of initialOrder) {
    const li = el(
      'li',
      'order-item',
      `<span class="order-handle" aria-hidden="true">≡</span>
       <span class="order-text">${esc(byId.get(id).text)}</span>
       <span class="order-arrows">
         <button class="icon-btn small" data-move="-1" aria-label="上移">↑</button>
         <button class="icon-btn small" data-move="1" aria-label="下移">↓</button>
       </span>`,
    );
    li.dataset.id = id;
    list.append(li);
  }

  const currentOrder = () => [...list.children].map((li) => li.dataset.id);

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-move]');
    if (!btn || locked) return;
    const li = btn.closest('li');
    if (btn.dataset.move === '-1' && li.previousElementSibling) {
      list.insertBefore(li, li.previousElementSibling);
    } else if (btn.dataset.move === '1' && li.nextElementSibling) {
      list.insertBefore(li.nextElementSibling, li);
    } else {
      return;
    }
    feedback('tap');
    onChange();
  });

  let drag = null;

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.order-handle');
    if (!handle || locked) return;
    e.preventDefault();
    const li = handle.closest('li');
    handle.setPointerCapture(e.pointerId);
    li.classList.add('dragging');
    drag = { li, handle, startY: e.clientY };
    feedback('tap');
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { li } = drag;
    const y = e.clientY;
    const before = li.offsetTop;
    const prev = li.previousElementSibling;
    const next = li.nextElementSibling;
    if (prev) {
      const r = prev.getBoundingClientRect();
      if (y < r.top + r.height / 2) list.insertBefore(li, prev);
    }
    if (next && li.nextElementSibling === next) {
      const r = next.getBoundingClientRect();
      if (y > r.top + r.height / 2) list.insertBefore(next, li);
    }
    // DOM 位置变化后修正起点，让卡片继续跟手
    drag.startY += li.offsetTop - before;
    li.style.transform = `translateY(${y - drag.startY}px)`;
  });

  const endDrag = () => {
    if (!drag) return;
    drag.li.classList.remove('dragging');
    drag.li.style.transform = '';
    drag = null;
    onChange();
  };
  list.addEventListener('pointerup', endDrag);
  list.addEventListener('pointercancel', endDrag);

  return {
    el: root,
    counter: () => '拖动 ≡ 调整顺序',
    isEmpty: () => false,
    response: () => ({ order: currentOrder() }),

    lock() {
      locked = true;
      root.classList.add('locked');
    },

    reveal(result) {
      this.lock();
      const playerOrder = currentOrder();
      for (const id of level.answer.sequence) {
        const li = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
        list.append(li);
        li.classList.toggle('is-answer', result.inPlace.includes(id));
        li.classList.toggle('is-wrong', !result.inPlace.includes(id));
        li.dataset.was = String(playerOrder.indexOf(id) + 1);
      }
    },

    destroy() {},
  };
}
