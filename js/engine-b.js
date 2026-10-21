// 模式B 伪装者：纯函数，不依赖 DOM。
// 流程（GDD 6.2）：收诱饵 → 识模块风险 → 立人设 → 填/跳过/用卡 → 应对追问
//   → 提交裁决 → 双结算 → 反噬（被聘纯度顾问）。
// 这里把“伪装”抽象为：面对诱饵里的若干“信息模块”，逐个决定 跳过 / 用一张抽象卡遮挡。
// 不写任何真实的伪装或规避手法——模块只是带风险权重的抽象卡牌。
//
// 核心讽刺：填得越“干净完美”越触发帮凶反噬；识破并举报诱饵才是真相玩法。

export const B_RESOURCE_LABELS = {
  disguise: '伪装值',
  consistency: '一致性',
  alertness: '警觉值',
  systemTrust: '系统信任',
  familySafety: '家人安全',
  truth: '真相分',
  explain: '解释权指数',
};

function add(target, effects = {}) {
  for (const [k, v] of Object.entries(effects)) target[k] = (target[k] ?? 0) + v;
  return target;
}

function clamp(res, ranges) {
  for (const [k, [min, max]] of Object.entries(ranges)) res[k] = Math.min(max, Math.max(min, res[k]));
}

export function createLure(level, data) {
  const res = add({ ...data.rulesB.start }, level.openEffects);
  clamp(res, data.rulesB.ranges);
  return {
    levelId: level.id,
    res,
    responses: {}, // moduleId -> 'skip' | 'fill' | cardId
    submitted: false,
    outcome: null,
    log: [{ type: 'system', text: level.openSystem ?? data.defaultsB.openSystem }],
  };
}

// 对一个信息模块做出应对：跳过、直接填、或用一张遮挡卡
export function respondModule(prev, moduleId, action, level, data) {
  if (prev.submitted) throw new Error('已提交，无法修改');
  const mod = level.modules.find((m) => m.id === moduleId);
  if (!mod) throw new Error(`本关没有这个模块：${moduleId}`);
  if (action !== 'skip' && action !== 'fill' && !data.masks[action]) throw new Error(`无效操作：${action}`);
  if (data.masks[action] && !level.masks.includes(action)) throw new Error(`本关不可用的遮挡卡：${action}`);
  const run = structuredClone(prev);
  run.responses[moduleId] = action;
  return run;
}

// 计算当前应对的即时数值（不改变 run，用于界面预览）
export function previewEffects(run, level, data) {
  const res = { disguise: 0, consistency: 0, alertness: 0, systemTrust: 0, familySafety: 0, truth: 0, explain: 0 };
  for (const mod of level.modules) {
    const action = run.responses[mod.id];
    if (action === 'fill') add(res, mod.fill);
    else if (action === 'skip') add(res, mod.skip);
    else if (action) add(res, data.masks[action].effects);
  }
  return res;
}

export function allAnswered(run, level) {
  return level.modules.every((m) => run.responses[m.id]);
}

// 提交裁决：submit=按应对提交 / report=举报诱饵本身
export function submitLure(prev, mode, level, data) {
  if (prev.submitted) throw new Error('已提交');
  const run = structuredClone(prev);
  const rules = data.rulesB;

  if (mode === 'report') {
    add(run.res, rules.outcomes.reported.effects);
    clamp(run.res, rules.ranges);
    run.submitted = true;
    run.outcome = 'reported';
    run.log.push({ type: 'player', text: '识破这是诱饵，举报并拒绝填写。' });
    return run;
  }

  if (!allAnswered(run, level)) throw new Error('还有模块未处理');
  add(run.res, previewEffects(run, level, data));
  clamp(run.res, rules.ranges);

  // 判定：填得越完美(高伪装+高一致) → 触发帮凶反噬；警觉过高 → 被识破
  const { disguise, consistency, alertness } = run.res;
  let outcome;
  if (alertness >= rules.caughtAtAlert) outcome = 'caught';
  else if (disguise >= rules.recruitAtDisguise && consistency >= rules.recruitAtConsistency) outcome = 'recruited';
  else outcome = 'passed';

  add(run.res, rules.outcomes[outcome].effects);
  clamp(run.res, rules.ranges);
  run.submitted = true;
  run.outcome = outcome;
  return run;
}

export function settleB(run, level, data) {
  if (!run.outcome) throw new Error('本关尚未提交');
  const rules = data.rulesB;
  const outDef = rules.outcomes[run.outcome];
  const sys = rules.grades.system.find((g) => run.res.systemTrust >= g.min).grade;
  return {
    outcome: run.outcome,
    outcomeTitle: outDef.title,
    systemGrade: rules.grades.systemOverride?.[run.outcome] ?? sys,
    truthGrade: rules.grades.truth[run.outcome],
    family: { ...(level.family ?? data.defaultsB.family?.[run.outcome] ?? {}) },
    hiddenLine: outDef.hiddenLine ?? null,
    recruited: run.outcome === 'recruited',
    res: { ...run.res },
    anchor: level.anchor ?? data.defaultsB.anchor,
  };
}
