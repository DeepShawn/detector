// 本地存档：一个 localStorage 键；存储不可用时退化为仅内存。
// 三模式共用一张表，记录每关最近一次结算的双评分与解释权。

const KEY = 'hyjj.save.v2';
const defaults = () => ({ levels: {}, explainTotal: 0 });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    /* 忽略不可用存储 */
  }
  return defaults();
}

const state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 存储不可用时仅内存 */
  }
}

export const save = {
  record(mode, levelId, s) {
    const key = `${mode}:${levelId}`;
    const prev = state.levels[key];
    state.levels[key] = {
      systemGrade: s.systemGrade,
      truthGrade: s.truthGrade,
      outcome: s.outcome,
      attempts: (prev?.attempts ?? 0) + 1,
    };
    state.explainTotal += s.res?.explain ?? 0;
    persist();
  },
  get(mode, levelId) {
    return state.levels[`${mode}:${levelId}`] ?? null;
  },
  solvedCount(mode) {
    return Object.keys(state.levels).filter((k) => k.startsWith(`${mode}:`)).length;
  },
  get explainTotal() {
    return state.explainTotal;
  },
  reset() {
    const d = defaults();
    Object.assign(state, d);
    state.levels = {};
    persist();
  },
};
