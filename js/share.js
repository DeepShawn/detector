// 成绩卡：用 Canvas 画一张竖版图片，优先调用系统分享，否则下载。

const W = 720;
const H = 960;
const SLOGAN = '你能 60 秒看出谁在说谎吗？';

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawCard(level, outcome) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (size, weight = 400) =>
    `${weight} ${size}px "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`;

  ctx.fillStyle = '#1f2430';
  ctx.fillRect(0, 0, W, H);

  // 档案纸
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.roundRect(48, 140, W - 96, 640, 24);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fffaf0';
  ctx.font = font(52, 700);
  ctx.fillText('一分钟谜案', W / 2, 96);

  ctx.fillStyle = '#8a7f70';
  ctx.font = font(26);
  ctx.fillText(`案件 ${level.id.toUpperCase()}`, W / 2, 210);

  ctx.fillStyle = '#2b2620';
  ctx.font = font(56, 700);
  ctx.fillText(`「${level.title}」`, W / 2, 290);

  ctx.fillStyle = '#e8a93a';
  ctx.font = font(84);
  ctx.fillText('★'.repeat(outcome.stars) + '☆'.repeat(3 - outcome.stars), W / 2, 420);

  ctx.fillStyle = '#2b2620';
  ctx.font = font(40, 700);
  ctx.fillText(`${outcome.used} 秒识破谎言`, W / 2, 500);

  ctx.fillStyle = '#5b5248';
  ctx.font = font(28);
  wrap(ctx, level.question, W - 200).forEach((line, i) => ctx.fillText(line, W / 2, 570 + i * 40));

  // 破案印章
  ctx.save();
  ctx.translate(W - 170, 700);
  ctx.rotate(-0.25);
  ctx.strokeStyle = '#e85d3a';
  ctx.lineWidth = 6;
  ctx.strokeRect(-90, -40, 180, 80);
  ctx.fillStyle = '#e85d3a';
  ctx.font = font(48, 700);
  ctx.fillText('已破案', 0, 16);
  ctx.restore();

  ctx.fillStyle = '#fffaf0';
  ctx.font = font(36, 700);
  ctx.fillText(SLOGAN, W / 2, 860);
  ctx.fillStyle = '#8f96a8';
  ctx.font = font(24);
  ctx.fillText('离线解谜 · 每关 60 秒', W / 2, 908);

  return canvas;
}

export async function shareResult(level, outcome) {
  const canvas = drawCard(level, outcome);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], `one-minute-mystery-${level.id}.png`, { type: 'image/png' });
  const text = `我用 ${outcome.used} 秒识破了「${level.title}」！${SLOGAN}`;

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: '一分钟谜案' });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
