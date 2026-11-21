// 全部声音都是现算出来的：一把弹拨的弦、几种纸和木头的噪声。没有音频文件。
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
  if (out && ctx) out.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
}

/** 浏览器要求由一次按键或点击来开声。 */
export function wake() {
  if (!ctx) {
    const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 0.5;
    const comp = ctx.createDynamicsCompressor();
    out.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

// 五声音阶：宫商角徵羽
const PENTA = [0, 2, 4, 7, 9];
const hz = (n: number) => 196 * Math.pow(2, n / 12);
/** 每个字有自己固定的一个音。 */
export function noteOf(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  return PENTA[c % 5] + 12 * ((c >> 3) % 2);
}

function pluck(n: number, when = 0, vol = 0.5, dur = 0.9) {
  if (!ctx || !out) return;
  const t = ctx.currentTime + when;
  const f = hz(n);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 7, t);
  lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur * 0.6);
  for (const [mul, type, v] of [[1, 'triangle', 1], [2.003, 'sine', 0.35], [3.01, 'sine', 0.12]] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * mul;
    const og = ctx.createGain();
    og.gain.value = v;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lp.connect(g).connect(out);
}

function noise(when: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1) {
  if (!ctx || !out || !noiseBuf) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t);
  fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(fl).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function thump(when: number, f0: number, f1: number, dur: number, vol: number) {
  if (!ctx || !out) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const step = () => {
  noise(0, 0.05, 0.16, 'bandpass', 1500 + Math.random() * 700, 900, 2);
  thump(0, 190 + Math.random() * 30, 120, 0.05, 0.12);
};
export const push = () => noise(0, 0.14, 0.12, 'bandpass', 500, 300, 1.5);
export const bump = () => thump(0, 110, 60, 0.12, 0.4);
export const heavy = () => {
  thump(0, 80, 40, 0.22, 0.6);
  noise(0, 0.1, 0.08, 'lowpass', 300);
};
export const merge = (ch: string) => {
  noise(0, 0.05, 0.2, 'highpass', 2500);
  pluck(noteOf(ch), 0, 0.5);
};
export const found = (ch: string) => {
  const n = noteOf(ch);
  noise(0, 0.05, 0.2, 'highpass', 2500);
  pluck(n, 0, 0.5, 1.4);
  pluck(n + 7, 0.11, 0.35, 1.4);
  pluck(n + 12, 0.22, 0.3, 1.8);
};
export const split = (ch: string) => {
  noise(0, 0.09, 0.22, 'highpass', 1800, 4000);
  pluck(noteOf(ch) - 5, 0.02, 0.28, 0.4);
};
export const nope = () => thump(0, 150, 100, 0.07, 0.25);
export const sink = () => {
  thump(0.05, 320, 70, 0.35, 0.55);
  noise(0.05, 0.4, 0.14, 'lowpass', 1200, 200);
};
export const fizz = () => noise(0, 0.7, 0.25, 'highpass', 3000, 7000);
export const burn = (wave: number) => {
  for (let i = 0; i < 6; i++) noise(wave * 0.12 + i * 0.05 + Math.random() * 0.03, 0.04, 0.18, 'bandpass', 900 + Math.random() * 2500, 600, 3);
  noise(wave * 0.12, 0.5, 0.08, 'lowpass', 700, 200);
};
export const eat = () => {
  thump(0, 240, 90, 0.12, 0.45);
  thump(0.09, 160, 60, 0.12, 0.35);
};
export const zzz = (k: number) => pluck(-12 + [9, 7, 4][k % 3], 0, 0.22, 1.2);
export const blink = () => noise(0, 0.12, 0.2, 'bandpass', 600, 5000, 4);
export const fly = () => noise(0, 0.22, 0.09, 'bandpass', 1400, 2400, 0.7);
export const float = () => thump(0, 520 + Math.random() * 120, 300, 0.09, 0.14);
export const tele = () => {
  pluck(12, 0, 0.3, 0.5);
  pluck(0, 0.1, 0.3, 0.8);
};
export const time = (night: boolean) => {
  const ns = night ? [9, 4, 0, -5] : [-5, 0, 4, 9, 12];
  ns.forEach((n, i) => pluck(n, i * 0.16, 0.26, 2.2));
};
export const stamp = () => {
  thump(0, 140, 50, 0.16, 0.7);
  noise(0, 0.06, 0.2, 'lowpass', 900);
};
export const win = () => [0, 4, 7, 12].forEach((n, i) => pluck(n, i * 0.09, 0.4, 1.6));
export const page = () => noise(0, 0.32, 0.12, 'bandpass', 2500, 700, 0.8);
export const finale = () => [0, 2, 4, 7, 9, 12, 16, 19].forEach((n, i) => pluck(n, i * 0.13, 0.36, 2.6));
