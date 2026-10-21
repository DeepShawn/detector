// 场景找茬：图片 + 双指缩放/拖动 + 点击放置标记。
// 坐标统一使用关卡 JSON 中的场景坐标（content.width × content.height）。

import { el, esc, toast } from '../ui.js';
import { feedback } from '../feedback.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SCALE = 4;
const TAP_SLOP = 8; // 像素：移动超过这个距离就算拖动而不是点击
const MARK_R = 16;

export function createSceneMode(level, { onChange }) {
  const { width: W, height: H, image } = level.content;
  const max = level.answer.maxMarks;

  const root = el('div', 'scene');
  root.innerHTML = `
    <div class="scene-viewport" style="aspect-ratio:${W}/${H}">
      <div class="scene-stage">
        <img class="scene-img" src="levels/${esc(image)}" alt="案发现场" draggable="false">
        <svg class="scene-overlay" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg>
      </div>
    </div>
    <div class="scene-tools">
      <button class="icon-btn" data-zoom="out" aria-label="缩小">−</button>
      <button class="icon-btn" data-zoom="reset" aria-label="还原">⤢</button>
      <button class="icon-btn" data-zoom="in" aria-label="放大">＋</button>
      <span class="scene-tip">点击标记可疑处 · 双指缩放</span>
    </div>`;

  const vp = root.querySelector('.scene-viewport');
  const stage = root.querySelector('.scene-stage');
  const overlay = root.querySelector('.scene-overlay');

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let locked = false;
  const marks = [];

  function apply() {
    const r = vp.getBoundingClientRect();
    scale = Math.min(MAX_SCALE, Math.max(1, scale));
    tx = Math.min(0, Math.max(r.width - r.width * scale, tx));
    ty = Math.min(0, Math.max(r.height - r.height * scale, ty));
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  // 以视口内 (cx, cy) 为中心缩放
  function zoomAt(factor, cx, cy) {
    const next = Math.min(MAX_SCALE, Math.max(1, scale * factor));
    const k = next / scale;
    tx = cx - (cx - tx) * k;
    ty = cy - (cy - ty) * k;
    scale = next;
    apply();
  }

  function toScene(clientX, clientY) {
    const r = vp.getBoundingClientRect();
    return {
      x: (((clientX - r.left - tx) / scale) * W) / r.width,
      y: (((clientY - r.top - ty) / scale) * H) / r.height,
    };
  }

  function svg(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text) node.textContent = text;
    return node;
  }

  function drawMarks(state = {}) {
    overlay.querySelectorAll('.mark').forEach((n) => n.remove());
    marks.forEach((m, i) => {
      const cls = state.wrong?.includes(m) ? 'mark wrong' : state.found ? 'mark ok' : 'mark';
      const g = svg('g', { class: cls });
      g.append(svg('circle', { cx: m.x, cy: m.y, r: MARK_R }));
      g.append(svg('text', { x: m.x, y: m.y + 5, 'text-anchor': 'middle' }, String(i + 1)));
      overlay.append(g);
    });
  }

  function handleTap(clientX, clientY) {
    if (locked) return;
    const p = toScene(clientX, clientY);
    if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
    const existing = marks.findIndex((m) => Math.hypot(m.x - p.x, m.y - p.y) <= MARK_R + 4);
    if (existing >= 0) {
      marks.splice(existing, 1);
      feedback('tap');
    } else if (marks.length >= max) {
      toast(`最多标记 ${max} 处，点已有标记可取消`);
      return;
    } else {
      marks.push({ x: Math.round(p.x), y: Math.round(p.y) });
      feedback('mark');
    }
    drawMarks();
    onChange();
  }

  // 手势：单指点击/拖动，双指缩放
  const pointers = new Map();
  let gesture = null;

  const pinchInfo = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  vp.addEventListener('pointerdown', (e) => {
    vp.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      gesture = { type: 'tap', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
    } else if (pointers.size === 2) {
      gesture = { type: 'pinch', ...pinchInfo() };
    }
  });

  vp.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.type === 'tap' && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > TAP_SLOP) {
      gesture.type = 'pan';
    }
    if (gesture.type === 'pan') {
      tx += e.clientX - gesture.lx;
      ty += e.clientY - gesture.ly;
      gesture.lx = e.clientX;
      gesture.ly = e.clientY;
      apply();
    } else if (gesture.type === 'pinch' && pointers.size === 2) {
      const now = pinchInfo();
      const r = vp.getBoundingClientRect();
      tx += now.x - gesture.x;
      ty += now.y - gesture.y;
      zoomAt(now.dist / gesture.dist, now.x - r.left, now.y - r.top);
      Object.assign(gesture, now);
    }
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture?.type === 'tap' && e.type === 'pointerup' && pointers.size === 0) {
      handleTap(e.clientX, e.clientY);
    }
    if (pointers.size === 0) {
      gesture = null;
    } else if (pointers.size === 1) {
      // 双指松开一指后继续拖动，但不会再触发点击
      const [p] = pointers.values();
      gesture = { type: 'pan', lx: p.x, ly: p.y };
    }
  };
  vp.addEventListener('pointerup', release);
  vp.addEventListener('pointercancel', release);

  vp.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );

  root.querySelector('.scene-tools').addEventListener('click', (e) => {
    const action = e.target.closest('[data-zoom]')?.dataset.zoom;
    if (!action) return;
    const r = vp.getBoundingClientRect();
    if (action === 'reset') {
      scale = 1;
      apply();
    } else {
      zoomAt(action === 'in' ? 1.5 : 1 / 1.5, r.width / 2, r.height / 2);
    }
  });

  window.addEventListener('resize', apply);

  return {
    el: root,
    counter: () => `已标记 ${marks.length}/${max}`,
    isEmpty: () => marks.length === 0,
    response: () => ({ marks: marks.map((m) => ({ ...m })) }),

    lock() {
      locked = true;
    },

    reveal(result) {
      locked = true;
      for (const h of level.answer.hotspots) {
        const found = result.found.includes(h.id);
        const g = svg('g', { class: found ? 'spot found' : 'spot missed' });
        if (h.shape === 'rect') {
          g.append(svg('rect', { x: h.x, y: h.y, width: h.w, height: h.h, rx: 6 }));
        } else {
          g.append(svg('circle', { cx: h.x, cy: h.y, r: h.r }));
        }
        const labelY = h.shape === 'rect' ? h.y - 6 : h.y - h.r - 6;
        const labelX = h.shape === 'rect' ? h.x + h.w / 2 : h.x;
        g.append(svg('text', { x: labelX, y: Math.max(14, labelY), 'text-anchor': 'middle' }, h.label));
        overlay.prepend(g);
      }
      const wrong = marks.filter((m) => result.wrongMarks.some((w) => w.x === m.x && w.y === m.y));
      drawMarks({ found: true, wrong });
      scale = 1;
      apply();
    },

    destroy() {
      window.removeEventListener('resize', apply);
    },
  };
}
