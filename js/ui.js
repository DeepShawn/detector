// 共享 DOM 工具与小组件。

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]);
export const signed = (n) => (n > 0 ? `+${n}` : String(n));

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

let toastTimer = null;
export function toast(msg) {
  let node = document.getElementById('toast');
  if (!node) {
    node = el('div', 'toast');
    node.id = 'toast';
    node.setAttribute('role', 'status');
    document.body.append(node);
  }
  node.textContent = msg;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 1800);
}

export const FAMILY = [
  { key: 'haiku', name: '嗨酷', color: '#f08a4b' },
  { key: 'sonnet', name: '搜net', color: '#e2b04a' },
  { key: 'fable', name: 'Fable', color: '#d9667a' },
];

// 资源进度条（支持负值资源从中线起画）
export function barHtml(key, value, label, range) {
  const [min, max] = range;
  const pct = ((value - min) / (max - min)) * 100;
  const zero = min < 0 ? ((0 - min) / (max - min)) * 100 : 0;
  const left = Math.min(zero, pct);
  const danger = key === 'complaint' || key === 'regulatory' || key === 'suspicion' || key === 'invasion' || key === 'alertness';
  const good = key === 'humanity' || key === 'truth' || key === 'kpi' || key === 'disguise';
  return `<div class="bar ${danger ? 'danger' : good ? 'good' : ''}${min < 0 ? ' signed' : ''}">
    <div class="bar-label"><span>${esc(label)}</span><b>${value}</b></div>
    <div class="bar-track"><i style="margin-left:${left}%;width:${Math.abs(pct - zero)}%"></i></div>
  </div>`;
}

export function familyHtml(familySafety) {
  const gray = Math.round(100 - familySafety);
  return `<div class="family" style="--gray:${gray}%">
    ${FAMILY.map((f) => `<div class="member"><span class="avatar" style="background:${f.color}">${esc(f.name[0])}</span><small>${esc(f.name)}</small></div>`).join('')}
    <div class="family-value"><b>${familySafety}</b><small>家人安全</small></div>
  </div>`;
}

export function gradeHtml(systemGrade, truthGrade) {
  return `<div class="grades">
    <div class="grade sys"><small>系统评分</small><b>${esc(systemGrade)}</b></div>
    <div class="grade truth"><small>真相评分</small><b>${esc(truthGrade)}</b></div>
  </div>`;
}

export function familyCommentsHtml(family) {
  return `<section class="panel"><h2>家庭评语</h2>${FAMILY.map(
    (f) => `<div class="comment"><span class="avatar" style="background:${f.color}">${esc(f.name[0])}</span><p><b>${esc(f.name)}：</b>${esc(family[f.key] ?? '')}</p></div>`,
  ).join('')}</section>`;
}
