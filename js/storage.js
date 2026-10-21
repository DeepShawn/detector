// 本地存档：一个 localStorage 键。读写失败（隐私模式等）时退化为仅内存。

const KEY = 'yfmz.save.v1';

const defaults = () => ({
  levels: {},
  settings: { sound: true, vibrate: true },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        levels: data.levels ?? {},
        settings: { ...defaults().settings, ...data.settings },
      };
    }
  } catch {
    // 忽略损坏或不可用的存储
  }
  return defaults();
}

let state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时本局仍可玩，只是不保存
  }
}

export const save = {
  get settings() {
    return state.settings;
  },

  setSetting(key, value) {
    state.settings[key] = value;
    persist();
  },

  record(levelId) {
    return state.levels[levelId] ?? null;
  },

  recordResult(levelId, { stars, remaining }) {
    const rec = state.levels[levelId] ?? { stars: 0, bestRemaining: 0, attempts: 0 };
    rec.attempts += 1;
    rec.stars = Math.max(rec.stars, stars);
    if (stars > 0) rec.bestRemaining = Math.max(rec.bestRemaining, remaining);
    state.levels[levelId] = rec;
    persist();
    return rec;
  },

  totalStars() {
    return Object.values(state.levels).reduce((sum, r) => sum + r.stars, 0);
  },

  resetProgress() {
    state = { ...defaults(), settings: state.settings };
    persist();
  },
};
