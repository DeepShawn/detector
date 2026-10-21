// 本地存档：一个 localStorage 键；存储不可用时退化为仅内存。

const KEY = 'hyjj.save.v1';

const defaults = () => ({ runs: {}, explainTotal: 0 });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    // 忽略损坏或不可用的存储
  }
  return defaults();
}

const state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时本局仍可玩，只是不保存
  }
}

export const save = {
  // 每个“工单 × 设备档案”记录最近一次结算
  recordRun(ticketId, platform, settlement) {
    state.runs[`${ticketId}:${platform}`] = {
      systemGrade: settlement.systemGrade,
      truthGrade: settlement.truthGrade,
      outcomeTitle: settlement.outcomeTitle,
    };
    state.explainTotal += settlement.res.explain;
    persist();
  },
  run(ticketId, platform) {
    return state.runs[`${ticketId}:${platform}`] ?? null;
  },
  get explainTotal() {
    return state.explainTotal;
  },
};
