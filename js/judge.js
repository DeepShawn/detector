// 纯函数：判定与评分。不依赖 DOM，便于在 Node 中测试。

export function hitTest(shape, x, y) {
  if (shape.shape === 'rect') {
    return x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h;
  }
  return Math.hypot(x - shape.x, y - shape.y) <= shape.r;
}

// response: { marks: [{x,y}] } | { picks: [id] } | { order: [id] }
export function judge(level, response) {
  const answer = level.answer;
  switch (answer.kind) {
    case 'hotspots':
      return judgeHotspots(answer, response.marks ?? []);
    case 'pick':
      return judgePick(answer, response.picks ?? []);
    case 'order':
      return judgeOrder(answer, response.order ?? []);
    default:
      throw new Error(`未知的答案类型：${answer.kind}`);
  }
}

function judgeHotspots(answer, marks) {
  const found = new Set();
  const wrongMarks = [];
  for (const m of marks) {
    const hit = answer.hotspots.find((h) => hitTest(h, m.x, m.y));
    if (hit) found.add(hit.id);
    else wrongMarks.push(m);
  }
  return {
    correct: found.size === answer.hotspots.length && wrongMarks.length === 0,
    found: [...found],
    wrongMarks,
  };
}

function judgePick(answer, picks) {
  const expected = new Set(answer.ids);
  const found = picks.filter((id) => expected.has(id));
  const wrong = picks.filter((id) => !expected.has(id));
  return {
    correct: found.length === expected.size && wrong.length === 0,
    found,
    wrong,
  };
}

function judgeOrder(answer, order) {
  const inPlace = order.filter((id, i) => answer.sequence[i] === id);
  return {
    correct: inPlace.length === answer.sequence.length && order.length === answer.sequence.length,
    inPlace,
  };
}

// 星级：答对按剩余时间给 1–3 星；用过提示最多 2 星；答错 0 星。
export function computeStars({ correct, remaining, timeLimit, hintUsed }) {
  if (!correct) return 0;
  let stars = remaining >= timeLimit / 2 ? 3 : remaining >= timeLimit / 6 ? 2 : 1;
  if (hintUsed) stars = Math.min(stars, 2);
  return stars;
}
