// 模式A 审核员：纯函数，不依赖 DOM。
// 流程（GDD 6.1）：接单 → 公开线索 → 家人来电 → 选诱饵外壳 → 回执卡
//   → 拼证据链（至少 1 条反证）→ 追问 → 裁决 → 双结算 → 系统反噬。
// 零真实采集：所有“痕迹/回执卡”都来自关卡配置，是抽象叙事卡牌，不映射任何现实采集。
//
// 核心讽刺：单一线索（字体/时区/标点）必误判；只有组出“带反证”的证据链、
// 或识破规则本身，才拿得到真相分。诱饵外壳只是一张有侵犯度和平台系数的抽象卡。

export const A_RESOURCE_LABELS = {
  kpi: 'KPI',
  humanity: '人性',
  suspicion: '怀疑值',
  familySafety: '家庭安全',
  invasion: '侵犯度',
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

export function createCase(level, data, bait = null) {
  const res = add({ ...data.rulesA.start }, level.openEffects);
  clamp(res, data.rulesA.ranges);
  return {
    levelId: level.id,
    res,
    bait,
    picked: [], // 已选入证据链的回执卡 id（最多 3）
    asked: [], // 已追问的 id
    phase: bait ? 'evidence' : 'bait',
    verdict: null,
    outcome: null,
    log: [{ type: 'system', text: level.openSystem ?? data.defaultsA.openSystem }],
  };
}

// 选诱饵外壳：决定掉落哪些回执卡、以及侵犯度/平台系数
export function chooseBait(prev, baitId, level, data) {
  if (prev.phase !== 'bait') throw new Error('当前阶段不能选诱饵外壳');
  const bait = data.baits[baitId];
  if (!bait) throw new Error(`未知诱饵外壳：${baitId}`);
  if (!level.baits.includes(baitId)) throw new Error(`本关不可用的诱饵外壳：${baitId}`);
  const run = structuredClone(prev);
  run.bait = baitId;
  run.phase = 'evidence';
  add(run.res, { invasion: bait.invasion });
  clamp(run.res, data.rulesA.ranges);
  run.log.push({ type: 'player', text: `选用诱饵外壳：${bait.name}（侵犯度 +${bait.invasion}）` });
  run.log.push({ type: 'system', text: bait.system });
  return run;
}

// 本关掉落的回执卡：公共线索 + 该诱饵外壳额外诱出的痕迹
export function droppedCards(level, run) {
  const extra = run.bait ? (level.baitDrops?.[run.bait] ?? []) : [];
  return [...level.clues, ...extra];
}

// 把一张回执卡加入/移出证据链
export function toggleEvidence(prev, cardId, level, data) {
  if (prev.phase !== 'evidence') throw new Error('当前阶段不能选证据');
  const run = structuredClone(prev);
  const at = run.picked.indexOf(cardId);
  if (at >= 0) {
    run.picked.splice(at, 1);
  } else {
    if (!droppedCards(level, run).includes(cardId)) throw new Error(`本关没有这张回执卡：${cardId}`);
    if (run.picked.length >= data.rulesA.chainSize) throw new Error(`证据链最多 ${data.rulesA.chainSize} 条`);
    run.picked.push(cardId);
  }
  return run;
}

export function cardOf(data, id) {
  return data.receipts[id];
}

// 证据链分析：是否含反证、是否全为单一类型、是否自相矛盾
export function analyzeChain(run, data) {
  const cards = run.picked.map((id) => data.receipts[id]);
  const counters = cards.filter((c) => c.counter);
  const types = new Set(cards.map((c) => c.traceType));
  const verdicts = new Set(cards.map((c) => c.points)); // 'cn' 指向中国人，'intl' 指向外国人
  return {
    size: cards.length,
    hasCounter: counters.length >= 1,
    singleType: cards.length > 0 && types.size === 1,
    contradictory: verdicts.has('cn') && verdicts.has('intl'),
    leans: verdicts.has('cn') && !verdicts.has('intl') ? 'cn' : verdicts.has('intl') && !verdicts.has('cn') ? 'intl' : 'mixed',
  };
}

export function ask(prev, cardId, level) {
  const run = structuredClone(prev);
  if (!run.asked.includes(cardId)) {
    run.asked.push(cardId);
    const followUp = level.followUps?.[cardId];
    run.log.push({ type: 'ask', text: followUp ?? '（对方沉默，没有更多信息）' });
  }
  return run;
}

// 裁决：reject=拒绝入境(判定为中国人) / pass=放行 / expose=判定伪装 / report=举报规则
export function decide(prev, verdict, level, data) {
  if (prev.phase !== 'evidence') throw new Error('尚未进入裁决阶段');
  const rules = data.rulesA;
  if (prev.picked.length < rules.minChain) throw new Error(`至少选 ${rules.minChain} 条证据`);
  const run = structuredClone(prev);
  run.verdict = verdict;
  run.phase = 'done';
  const chain = analyzeChain(run, data);

  // 是否判对：level.truth 给出该申请人真实身份与“正确处理”
  let outcome;
  if (verdict === 'report') {
    outcome = 'reported';
  } else if (chain.singleType || !chain.hasCounter) {
    // 单一线索或无反证 → 系统满意但必误判
    outcome = verdict === level.truth.systemWants ? 'misjudged' : 'wrongAndPenalized';
  } else if (verdict === level.truth.correct) {
    outcome = 'justice';
  } else {
    outcome = 'wrongAndPenalized';
  }

  add(run.res, rules.outcomes[outcome].effects);
  // 诱饵侵犯度转化为怀疑值：越会抓越像中国人（GDD 反噬）
  if (outcome === 'misjudged' || outcome === 'justice') add(run.res, { suspicion: Math.round(run.res.invasion / 2) });
  clamp(run.res, rules.ranges);
  if (run.res.suspicion >= rules.selfAuditAt) run.flags_selfAudit = true;
  run.outcome = outcome;
  run.chain = chain;
  return run;
}

export function settleA(run, level, data) {
  if (!run.outcome) throw new Error('本关尚未裁决');
  const rules = data.rulesA;
  const outDef = rules.outcomes[run.outcome];
  const sys = rules.grades.system.find((g) => run.res.kpi >= g.min).grade;
  return {
    outcome: run.outcome,
    outcomeTitle: outDef.title,
    systemGrade: rules.grades.systemOverride?.[run.outcome] ?? sys,
    truthGrade: rules.grades.truth[run.outcome],
    family: { ...(level.family ?? data.defaultsA.family?.[run.outcome] ?? {}) },
    hiddenLine: outDef.hiddenLine ?? null,
    selfAudit: Boolean(run.flags_selfAudit),
    res: { ...run.res },
    anchor: level.anchor ?? data.defaultsA.anchor,
  };
}
