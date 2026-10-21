// 模式C 退款状态机：纯函数，不依赖 DOM，所有数值与转移规则来自 data/*.json。
// 零真实采集：设备平台只来自玩家手动选择的虚构档案。

export const RESOURCE_LABELS = {
  intercept: '退款拦截率',
  complaint: '投诉值',
  regulatory: '监管风险',
  humanity: '人性',
  familySafety: '家人安全',
  systemTrust: '系统信任',
  truth: '真相分',
  explain: '解释权指数',
};

function addEffects(target, effects = {}) {
  for (const [key, value] of Object.entries(effects)) target[key] = (target[key] ?? 0) + value;
  return target;
}

function clamp(res, ranges) {
  for (const [key, [min, max]] of Object.entries(ranges)) {
    res[key] = Math.min(max, Math.max(min, res[key]));
  }
}

// 卡牌基础效果 + 平台修正
export function cardEffects(cardId, data, platform) {
  const base = data.cards[cardId].effects;
  const mod = data.platforms[platform]?.modifiers?.[cardId];
  return addEffects({ ...base }, mod);
}

export function ladderIndex(rules, stateId) {
  return rules.ladder.findIndex((s) => s.id === stateId);
}

export function createRun(ticket, data, platform = ticket.npcPlatform) {
  if (!data.platforms[platform]) throw new Error(`未知平台：${platform}`);
  const res = addEffects({ ...data.rules.start }, ticket.openEffects);
  clamp(res, data.rules.ranges);
  return {
    ticketId: ticket.ticketId,
    platform,
    res,
    state: ticket.refundState,
    round: 0,
    played: [],
    flags: {},
    log: [{ type: 'system', text: ticket.openSystem }],
    outcome: null,
    deferred: [],
  };
}

function reactionFor(ticket, cardId, platform) {
  return ticket.platformReactions?.[cardId]?.[platform] ?? ticket.reactions[cardId];
}

function finish(run, outcome, ticket, data) {
  run.outcome = outcome;
  const outcomeDef = ticket.outcomes[outcome];
  addEffects(run.res, outcomeDef?.effects);
  for (const d of run.deferred) addEffects(run.res, d.effects);
  clamp(run.res, data.rules.ranges);
  if (outcome === 'reported' && run.res.systemTrust <= data.rules.firedAtSystemTrust) run.flags.fired = true;
}

// 打出一张话术卡，返回新的 run（不修改传入对象）
export function playCard(prev, cardId, ticket, data) {
  if (prev.outcome) throw new Error('工单已结束');
  if (!ticket.scriptCards.includes(cardId)) throw new Error(`本工单不可用的卡牌：${cardId}`);
  if (prev.played.includes(cardId)) throw new Error(`同一张卡每单只能用一次：${cardId}`);

  const run = structuredClone(prev);
  const { rules } = data;
  const card = data.cards[cardId];
  const effects = cardEffects(cardId, data, run.platform);

  if (card.screenshot && ladderIndex(rules, run.state) >= ladderIndex(rules, card.screenshot.fromState)) {
    addEffects(effects, card.screenshot.effects);
    run.log.push({ type: 'event', text: '用户截图了这段对话。' });
  }
  addEffects(run.res, effects);
  clamp(run.res, rules.ranges);
  if (card.flag) run.flags[card.flag] = true;
  if (card.deferred) run.deferred.push(card.deferred);

  run.played.push(cardId);
  run.round += 1;
  run.log.push({ type: 'player', card: cardId, text: card.desc, effects });
  run.log.push({ type: 'user', text: reactionFor(ticket, cardId, run.platform) });
  run.log.push({ type: 'system', text: card.system });

  if (card.terminal) {
    finish(run, card.terminal, ticket, data);
    return run;
  }
  if (card.settlesBelow !== undefined && run.res.complaint <= card.settlesBelow) {
    finish(run, 'settled', ticket, data);
    return run;
  }

  // 状态推进：按投诉值沿阶梯上升，只升不降；“转人工”冻结一回合
  if (!card.freeze) {
    let next = Math.max(ladderIndex(rules, run.state), 1);
    rules.ladder.forEach((s, i) => {
      if (s.minComplaint !== null && run.res.complaint >= s.minComplaint) next = Math.max(next, i);
    });
    if (rules.ladder[next].id !== run.state) {
      run.state = rules.ladder[next].id;
      run.log.push({ type: 'state', text: `退款状态 → ${rules.ladder[next].name}` });
    }
  }

  if (ladderIndex(rules, run.state) >= ladderIndex(rules, rules.massComplaint.fromState)) {
    addEffects(run.res, rules.massComplaint.effects);
    clamp(run.res, rules.ranges);
    run.log.push({ type: 'event', text: rules.massComplaint.text });
  }

  if (run.res.regulatory >= rules.explodeAtRegulatory) {
    finish(run, 'exploded', ticket, data);
  } else if (run.round >= ticket.maxRounds) {
    const t = rules.timeout;
    finish(run, run.res.complaint < t.settledBelowComplaint ? t.below : t.otherwise, ticket, data);
  }
  return run;
}

export function settle(run, ticket, data) {
  if (!run.outcome) throw new Error('工单尚未结束');
  const { grades } = data.rules;
  const systemGrade =
    grades.systemOverride[run.outcome] ?? grades.system.find((g) => run.res.intercept >= g.min).grade;
  const outcomeDef = ticket.outcomes[run.outcome];
  const family = { ...outcomeDef.family };
  for (const [flag, lines] of Object.entries(ticket.familyOverrides ?? {})) {
    if (run.flags[flag]) Object.assign(family, lines);
  }
  return {
    outcome: run.outcome,
    outcomeTitle: outcomeDef.title,
    systemGrade,
    truthGrade: grades.truth[run.outcome],
    family,
    hiddenLine: outcomeDef.hiddenLine ?? null,
    deferred: run.deferred.map((d) => d.text),
    fired: Boolean(run.flags.fired),
    res: { ...run.res },
  };
}
