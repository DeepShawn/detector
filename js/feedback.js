// 音效（WebAudio 合成，无需音频文件）与震动反馈，均受设置开关控制。

import { save } from './storage.js';

const VIBRATION = {
  tap: 8,
  mark: 15,
  correct: [30, 60, 30],
  wrong: [80, 50, 80],
  tick: 0,
};

const TONES = {
  tap: [[660, 0.04]],
  mark: [[880, 0.05]],
  correct: [[660, 0.09], [880, 0.09], [1320, 0.16]],
  wrong: [[220, 0.14], [180, 0.22]],
  tick: [[1200, 0.03]],
};

let ctx = null;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function play(notes) {
  const ac = audio();
  if (!ac) return;
  let t = ac.currentTime;
  for (const [freq, dur] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur * 0.9;
  }
}

export function feedback(kind) {
  const { sound, vibrate } = save.settings;
  if (vibrate && VIBRATION[kind] && navigator.vibrate) navigator.vibrate(VIBRATION[kind]);
  if (sound && TONES[kind]) {
    try {
      play(TONES[kind]);
    } catch {
      // 音频不可用时静默
    }
  }
}
