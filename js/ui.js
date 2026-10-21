// 小型 DOM 工具。

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function stars(n, max = 3) {
  return '★'.repeat(n) + '☆'.repeat(max - n);
}

export const CATEGORY_LABELS = {
  timeline: '时间线矛盾',
  item: '物品不合理',
  testimony: '证词冲突',
  chat: '聊天记录找谎',
  order: '排序推理',
};

let toastTimer = null;

export function toast(message) {
  let node = document.getElementById('toast');
  if (!node) {
    node = el('div', 'toast');
    node.id = 'toast';
    node.setAttribute('role', 'status');
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 1800);
}
