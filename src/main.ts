import './style.css';
import { PAGES } from './levels.ts';
import { ALL_FOUND, GLOSS, IDIOM, LIGHT, formOf, isExit, isFire, isHeavy } from './glyphs.ts';
import { DX, DY, FILLED, VOID, WATER, act, changed, cloneState, lit, parseLevel, terrAt, you } from './rules.ts';
import type { Dir, Ev, State } from './rules.ts';
import * as sfx from './audio.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sheet = $('sheet');
const cellsEl = $('cells');
const entsEl = $('ents');
const dark = $<HTMLCanvasElement>('dark');
const fx = $<HTMLCanvasElement>('fx');
const dctx = dark.getContext('2d')!;
const fctx = fx.getContext('2d')!;
const maskCv = document.createElement('canvas');
const mctx = maskCv.getContext('2d')!;

// ---------- 存档 ----------
interface Save {
  cur: number;
  max: number;
  found: string[];
  seals: string[];
  mute: boolean;
  split: boolean;
  done: boolean;
}
const KEY = 'huozi.v1';
const save: Save = { cur: 0, max: 0, found: [], seals: [], mute: false, split: false, done: false };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) Object.assign(save, JSON.parse(raw));
} catch {
  /* 没有存档也能玩 */
}
save.max = Math.min(Math.max(0, save.max | 0), PAGES.length - 1);
save.cur = Math.min(Math.max(0, save.cur | 0), save.max);
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* 无痕模式 */
  }
}

// ---------- 这一页 ----------
let s: State;
let hist: State[] = [];
let gen = 0; // 每次整页重画加一，过期的延时动画看到它变了就作罢
let cell = 64;
let ox = 0;
let oy = 0;
let locked = false;
let hintAt = 0;
let pageStart = 0;
let moved = false;
const divs = new Map<number, HTMLElement>();
const later = (ms: number, fn: () => void) => {
  const g = gen;
  setTimeout(() => g === gen && fn(), ms);
};

function mk(ch: string, x: number, y: number, extra = ''): HTMLElement {
  const d = document.createElement('div');
  d.className = 'ent snap ' + extra;
  d.innerHTML = '<span class="g"></span><span class="face"></span>';
  (d.firstChild as HTMLElement).textContent = ch;
  put(d, x, y);
  entsEl.appendChild(d);
  void d.offsetWidth;
  d.classList.remove('snap');
  return d;
}
const put = (d: HTMLElement, x: number, y: number) => {
  d.style.transform = `translate3d(${x * cell}px,${y * cell}px,0)`;
};
function dress(d: HTMLElement, ch: string, isYou: boolean) {
  d.dataset.ch = ch;
  (d.firstChild as HTMLElement).textContent = ch;
  d.classList.toggle('you', isYou);
  d.classList.toggle('heavy', isHeavy(ch));
  d.classList.toggle('fire', isFire(ch));
  d.classList.toggle('exit', isExit(ch));
  d.classList.toggle('lamp', LIGHT[ch] !== undefined);
  d.classList.toggle('wet', ch === '沐');
}
function kick(d: HTMLElement | undefined, cls: string) {
  if (!d) return;
  d.classList.remove('pop', 'unpop', 'b0', 'b1', 'b2', 'b3', 'shake', 'scorch');
  void d.offsetWidth;
  d.classList.add(cls);
}

function drawCells(fresh?: { x: number; y: number }[]) {
  cellsEl.textContent = '';
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const t = terrAt(s, x, y);
      if (t === VOID) continue;
      const c = document.createElement('div');
      c.className = 'cell' + (t === WATER ? ' water' : t === FILLED ? ' filled' : '');
      if (fresh?.some((f) => f.x === x && f.y === y)) c.classList.add('new');
      c.style.left = x * cell + 'px';
      c.style.top = y * cell + 'px';
      cellsEl.appendChild(c);
    }
  }
}

function sync() {
  const live = new Set<number>();
  for (const e of s.ents) {
    live.add(e.id);
    let d = divs.get(e.id);
    if (!d) {
      d = mk(e.g.ch, e.x, e.y);
      divs.set(e.id, d);
    }
    dress(d, e.g.ch, !!e.you);
    put(d, e.x, e.y);
    if (e.you) (d.lastChild as HTMLElement).style.transform = `rotate(${s.facing * 90}deg)`;
  }
  for (const [id, d] of divs) {
    if (!live.has(id)) {
      d.remove();
      divs.delete(id);
    }
  }
  document.body.classList.toggle('night', s.night);
}

function layout() {
  const W = innerWidth;
  const H = innerHeight;
  const top = $('top').offsetHeight;
  const foot = $('foot').offsetHeight;
  cell = Math.max(18, Math.floor(Math.min((W - 28) / s.w, (H - top - foot - 20) / s.h, 86)));
  document.documentElement.style.setProperty('--cell', cell + 'px');
  sheet.style.width = s.w * cell + 'px';
  sheet.style.height = s.h * cell + 'px';
  const dpr = Math.min(devicePixelRatio || 1, 2);
  for (const c of [dark, fx]) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  }
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 稿纸在屏幕上的位置（不受翻页动画的位移影响）
  const st = $('stage');
  ox = st.offsetLeft + (st.offsetWidth - s.w * cell) / 2;
  oy = st.offsetTop + (st.offsetHeight - s.h * cell) / 2;
  drawCells();
  for (const d of divs.values()) d.classList.add('snap');
  sync();
  void sheet.offsetWidth;
  for (const d of divs.values()) d.classList.remove('snap');
}

function rebuild() {
  gen++;
  entsEl.textContent = '';
  divs.clear();
  parts.length = 0;
  bright = [];
  layout();
}

function load(i: number, anim = true) {
  save.cur = i;
  save.max = Math.max(save.max, i);
  persist();
  const go = () => {
    s = parseLevel(PAGES[i].rows, PAGES[i].night);
    hist = [];
    locked = false;
    moved = false;
    hintAt = 0;
    pageStart = performance.now();
    setHint('');
    clearTimeout(glossTimer);
    $('gloss').classList.remove('on');
    $('hintBtn').classList.remove('nag');
    rebuild();
    drawNav();
    if (PAGES[i].night) nightA = 1;
  };
  if (!anim) return go();
  locked = true;
  sheet.classList.add('out');
  sfx.page();
  setTimeout(() => {
    go();
    sheet.classList.remove('out');
    sheet.classList.add('in');
    void sheet.offsetWidth;
    sheet.classList.remove('in');
  }, 270);
}

// ---------- 页眉、页脚 ----------
function drawNav() {
  const nav = $('pages');
  nav.textContent = '';
  PAGES.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.name[0];
    b.title = i <= save.max ? `第${p.name}页`.replace('第白页页', '白页') : '还没写到';
    if (i <= save.max) b.classList.add('open');
    if (i === save.cur) b.classList.add('cur');
    b.onclick = () => {
      if (i <= save.max && i !== save.cur && !locked) load(i);
      b.blur();
    };
    nav.appendChild(b);
  });
  $('count').textContent = `${save.found.length}/${ALL_FOUND.length}`;
  $('muteBtn').classList.toggle('off', save.mute);
  $('kSplit').classList.toggle('known', save.split);
}

let glossTimer = 0;
function gloss(ch: string) {
  const g = $('gloss');
  g.classList.remove('on');
  void g.offsetWidth;
  (g.firstElementChild as HTMLElement).textContent = ch;
  (g.lastElementChild as HTMLElement).textContent = GLOSS[ch] ?? '';
  g.classList.add('on');
  clearTimeout(glossTimer);
  glossTimer = window.setTimeout(() => g.classList.remove('on'), 7000);
}
function setHint(t: string) {
  const h = $('hintText');
  if (!t) return void h.classList.remove('on');
  h.classList.remove('on');
  void h.offsetWidth;
  h.textContent = t;
  h.classList.add('on');
}
function nextHint() {
  const hs = PAGES[save.cur].hints;
  setHint(hs[Math.min(hintAt, hs.length - 1)]);
  hintAt++;
  $('hintBtn').classList.remove('nag');
  $('hintBtn').classList.add('on');
}

const stampQ: string[] = [];
let stamping = false;
function stamp(key: string) {
  if (save.seals.includes(key) || !IDIOM[key]) return;
  save.seals.push(key);
  persist();
  stampQ.push(key);
  if (!stamping) runStamp();
}
function runStamp() {
  const key = stampQ.shift();
  if (!key) return void (stamping = false);
  stamping = true;
  const el = $('stamp');
  el.classList.remove('on');
  el.innerHTML = [...IDIOM[key]].map((c) => `<span>${c}</span>`).join('');
  void el.offsetWidth;
  el.classList.add('on');
  sfx.stamp();
  setTimeout(runStamp, stampQ.length ? 1300 : 2900);
}

// ---------- 墨点、火星、水纹 ----------
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  r: number;
  col: string;
  ring?: boolean;
}
const parts: Part[] = [];
const cx = (x: number) => ox + (x + 0.5) * cell;
const cy = (y: number) => oy + (y + 0.5) * cell;
function burst(x: number, y: number, n: number, col: string, speed = 1, g = 0, r = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283;
    const v = (0.4 + Math.random()) * cell * 2.2 * speed;
    parts.push({ x: cx(x), y: cy(y), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, life: 0, max: 0.25 + Math.random() * 0.35, r: (1 + Math.random() * 2.4) * r * (cell / 64), col });
  }
}
function ring(x: number, y: number, col: string, max = 0.6, delay = 0) {
  parts.push({ x: cx(x), y: cy(y), vx: 0, vy: 0, g: 0, life: -delay, max, r: cell * 0.9, col, ring: true });
}
function embers(x: number, y: number, n: number, delay: number) {
  for (let i = 0; i < n; i++) {
    parts.push({
      x: cx(x) + (Math.random() - 0.5) * cell * 0.7, y: cy(y) + (Math.random() - 0.3) * cell * 0.5,
      vx: (Math.random() - 0.5) * cell * 0.8, vy: -cell * (0.8 + Math.random() * 1.6), g: -cell * 0.6,
      life: -delay - Math.random() * 0.15, max: 0.5 + Math.random() * 0.5, r: (1 + Math.random() * 1.8) * (cell / 64),
      col: Math.random() < 0.5 ? '240,140,30' : '250,200,80',
    });
  }
}

let nightA = 0; // 夜色浓度，慢慢靠近目标
let dimA = 0; // 打瞌睡时眼前发暗
let bright: number[] = [];
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const W = innerWidth;
  const H = innerHeight;
  if (s) {
    const me = you(s);
    const doze = me && me.g.ch === '休' ? s.sleep % 3 : 0;
    const k = 1 - Math.exp(-dt * 5);
    nightA += ((s.night ? 1 - doze * 0.17 : 0) - nightA) * k;
    dimA += ((s.night ? 0 : doze * 0.2) - dimA) * k;
    dctx.clearRect(0, 0, W, H);
    if (nightA > 0.004) {
      const N = 3;
      if (maskCv.width !== s.w * N || maskCv.height !== s.h * N) {
        maskCv.width = s.w * N;
        maskCv.height = s.h * N;
      }
      mctx.clearRect(0, 0, maskCv.width, maskCv.height);
      const kb = 1 - Math.exp(-dt * 9);
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const i = y * s.w + x;
          let target = lit(s, x, y) ? 1 : 0;
          if (!target && me && me.x === x && me.y === y) target = 0.5; // 至少看得见自己
          const b = (bright[i] = (bright[i] ?? target) + (target - (bright[i] ?? target)) * kb);
          if (b < 0.01) continue;
          mctx.fillStyle = `rgba(0,0,0,${b})`;
          mctx.fillRect(x * N, y * N, N, N);
        }
      }
      dctx.globalCompositeOperation = 'source-over';
      dctx.fillStyle = `rgba(11,13,27,${0.97 * nightA})`;
      dctx.fillRect(0, 0, W, H);
      dctx.globalCompositeOperation = 'destination-out';
      dctx.imageSmoothingEnabled = true;
      dctx.drawImage(maskCv, ox, oy, s.w * cell, s.h * cell);
      dctx.globalCompositeOperation = 'source-over';
    }
    if (dimA > 0.004) {
      dctx.fillStyle = `rgba(11,13,27,${dimA})`;
      dctx.fillRect(0, 0, W, H);
    }
  }
  fctx.clearRect(0, 0, W, H);
  if (s && nightA > 0.05) {
    fctx.globalCompositeOperation = 'lighter';
    for (const e of s.ents) {
      const r = LIGHT[e.g.ch];
      if (r === undefined) continue;
      const R = Math.min(r, 5) * cell;
      const g = fctx.createRadialGradient(cx(e.x), cy(e.y), 0, cx(e.x), cy(e.y), R);
      const col = e.g.ch === '月' || e.g.ch === '朋' ? '170,200,255' : isFire(e.g.ch) ? '255,150,60' : '255,220,140';
      const fl = isFire(e.g.ch) ? 0.85 + Math.random() * 0.3 : 1;
      g.addColorStop(0, `rgba(${col},${0.2 * nightA * fl})`);
      g.addColorStop(1, `rgba(${col},0)`);
      fctx.fillStyle = g;
      fctx.fillRect(cx(e.x) - R, cy(e.y) - R, R * 2, R * 2);
    }
    fctx.globalCompositeOperation = 'source-over';
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life < 0) continue;
    if (p.life >= p.max) {
      parts.splice(i, 1);
      continue;
    }
    const t = p.life / p.max;
    if (p.ring) {
      fctx.strokeStyle = `rgba(${p.col},${0.6 * (1 - t)})`;
      fctx.lineWidth = 2;
      fctx.beginPath();
      fctx.arc(p.x, p.y, p.r * (0.2 + 0.8 * t), 0, 6.283);
      fctx.stroke();
      continue;
    }
    p.vy += p.g * dt;
    p.vx *= 1 - dt * 4;
    p.vy *= 1 - dt * 4;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    fctx.fillStyle = `rgba(${p.col},${1 - t})`;
    fctx.beginPath();
    fctx.arc(p.x, p.y, p.r * (1 - t * 0.6), 0, 6.283);
    fctx.fill();
  }
  // 第一页：放着不动的话，铅笔字自己冒出来
  if (s && !locked && hintAt === 0 && !s.won) {
    const idle = now - pageStart;
    if ((save.cur === 0 && !moved && idle > 4500) || idle > 40000) nextHint();
  }
  if (s && !locked && !s.won && hintAt > 0 && now - pageStart > 90000) $('hintBtn').classList.add('nag');
  requestAnimationFrame(frame);
}

// ---------- 把规则吐出来的事件演给人看 ----------
const INK = '35,32,28';
const RED = '184,41,28';
function ghost(id: number, ch: string, fx_: number, fy_: number): HTMLElement {
  let d = id >= 0 ? divs.get(id) : undefined;
  if (d) divs.delete(id);
  else {
    d = mk(ch, fx_, fy_);
    dress(d, ch, false);
  }
  d.classList.add('ghost');
  return d;
}

function play(ev: Ev[]) {
  const me = you(s);
  const prev = new Map<number, string>();
  let stepped = false;
  let pushed = false;
  for (const e of ev) {
    switch (e.t) {
      case 'move':
        if (e.id === me.id) {
          stepped = true;
          if (e.how === 'blink') {
            const a = mk('闪', e.fx, e.fy, 'ghost after you');
            dress(a, '闪', true);
            requestAnimationFrame(() => a.classList.add('fade'));
            setTimeout(() => a.remove(), 260);
            sfx.blink();
          } else if (e.how === 'fly') sfx.fly();
          else if (e.how === 'float') {
            sfx.float();
            if (terrAt(s, e.x, e.y) === WATER) ring(e.x, e.y, '60,120,170', 0.5);
          } else if (e.how === 'tele') {
            sfx.tele();
            ring(e.fx, e.fy, RED, 0.5);
            ring(e.x, e.y, RED, 0.5, 0.1);
          }
        } else pushed = true;
        break;
      case 'bump': {
        kick(divs.get(me.id), 'b' + e.dir);
        if (formOf(me.g.ch).blink && e.why !== 'jail') {
          // 闪过不去的时候，让残影把“落点在两格外”演出来，免得看起来像被钉住了
          const tx = me.x + DX[e.dir] * 2;
          const ty = me.y + DY[e.dir] * 2;
          const a = mk(me.g.ch, me.x, me.y, 'ghost after miss');
          dress(a, me.g.ch, false);
          requestAnimationFrame(() => put(a, tx, ty));
          setTimeout(() => a.classList.add('fade'), 190);
          setTimeout(() => a.remove(), 460);
          ring(tx, ty, RED, 0.42, 0.1);
        }
        if (e.why === 'heavy') {
          sfx.heavy();
          const f = s.ents.find((o) => o.x === me.x + DX[e.dir] && o.y === me.y + DY[e.dir]);
          if (f) kick(divs.get(f.id), 'shake');
        } else if (e.why === 'water') {
          sfx.float();
          ring(me.x + DX[e.dir] * 0.6, me.y + DY[e.dir] * 0.6, '60,120,170', 0.45);
        } else sfx.bump();
        break;
      }
      case 'spawn':
        divs.set(e.id, mk('', e.fx, e.fy));
        break;
      case 'split':
        kick(divs.get(e.id), 'unpop');
        sfx.split(e.ch);
        burst(e.x, e.y, 5, e.id === me.id ? RED : INK, 0.6);
        if (!save.split) {
          save.split = true;
          persist();
        }
        $('kSplit').classList.remove('call');
        $('kSplit').classList.add('known');
        break;
      case 'merge': {
        if (e.gone >= 0 || !e.you) {
          const g = ghost(e.gone, e.part, e.fx, e.fy);
          put(g, e.x, e.y);
          g.classList.add('fade');
          setTimeout(() => g.remove(), 220);
        }
        const isNew = !save.found.includes(e.ch) && GLOSS[e.ch] !== undefined;
        const tgt = e.id;
        const x = e.x;
        const y = e.y;
        const col = e.you ? RED : e.ch === '沐' ? '59,111,148' : INK;
        setTimeout(() => {
          kick(divs.get(tgt), 'pop');
          burst(x, y, isNew ? 22 : 10, col, isNew ? 1.2 : 0.8);
          if (isNew) ring(x, y, col, 0.7);
        }, 60);
        if (isNew) {
          save.found.push(e.ch);
          persist();
          gloss(e.ch);
          sfx.found(e.ch);
          $('count').textContent = `${save.found.length}/${ALL_FOUND.length}`;
          const b = $('dictBtn');
          b.classList.remove('bump');
          void b.offsetWidth;
          b.classList.add('bump');
        } else sfx.merge(e.ch);
        if (e.you && !save.split && formOf(e.ch).immobile) later(1600, () => !save.split && $('kSplit').classList.add('known', 'call'));
        break;
      }
      case 'gone': {
        const g = ghost(e.id, e.ch, e.fx, e.fy);
        put(g, e.x, e.y);
        const cls = { sink: 'sunk', fizz: 'steam', burn: 'burning', eat: 'eaten' }[e.how];
        const delay = e.how === 'burn' ? e.wave * 120 : e.how === 'eat' ? 0 : 110;
        const x = e.x;
        const y = e.y;
        setTimeout(() => {
          g.classList.add(cls);
          if (e.how === 'sink') {
            ring(x, y, '60,120,170', 0.6);
            ring(x, y, '60,120,170', 0.8, 0.12);
            burst(x, y, 12, '86,140,186', 0.8, cell * 9);
          } else if (e.how === 'fizz') burst(x, y, 16, '230,230,230', 0.5, -cell * 6, 1.6);
          else if (e.how === 'burn') embers(x, y, 14, 0);
        }, delay);
        setTimeout(() => g.remove(), delay + 650);
        if (e.how === 'sink') sfx.sink();
        else if (e.how === 'fizz') sfx.fizz();
        else if (e.how === 'burn') sfx.burn(e.wave);
        else sfx.eat();
        break;
      }
      case 'char': {
        const d = divs.get(e.id);
        if (d) prev.set(e.id, d.dataset.ch ?? '');
        const { id, ch, x, y, wave } = e;
        sfx.burn(wave);
        later(wave * 120, () => {
          const dd = divs.get(id);
          if (!dd) return;
          (dd.firstChild as HTMLElement).textContent = ch;
          kick(dd, 'scorch');
          embers(x, y, 10, 0);
        });
        break;
      }
      case 'terr':
        later(120, () => drawCells([{ x: e.x, y: e.y }]));
        break;
      case 'zzz': {
        const z = document.createElement('div');
        z.className = 'zz';
        z.textContent = 'z';
        z.style.transform = `translate(${(me.x + 0.62) * cell}px,${(me.y - 0.05) * cell}px) scale(${1 + (s.sleep % 3) * 0.3})`;
        entsEl.appendChild(z);
        setTimeout(() => z.remove(), 1300);
        sfx.zzz(s.sleep);
        if (save.cur === 0 && !save.split && s.sleep === 2) $('kSplit').classList.add('known', 'call');
        break;
      }
      case 'time':
        sfx.time(e.night);
        break;
      case 'idiom':
        stamp(e.key);
        break;
      case 'hint':
        nextHint();
        break;
      case 'nosplit':
        kick(divs.get(me.id), 'shake');
        sfx.nope();
        break;
      case 'win':
        win(e.x, e.y);
        break;
    }
  }
  if (stepped && !ev.some((e) => e.t === 'merge' || e.t === 'win')) sfx.step();
  if (pushed) sfx.push();
  sync();
  // 被火燎到的字，等火烧到了再变
  for (const [id, ch] of prev) {
    const d = divs.get(id);
    if (d) (d.firstChild as HTMLElement).textContent = ch;
  }
}

function win(x: number, y: number) {
  locked = true;
  sfx.win();
  const me = divs.get(you(s).id);
  ring(x, y, RED, 0.7);
  ring(x, y, RED, 0.9, 0.15);
  burst(x, y, 26, RED, 1.3);
  setTimeout(() => me?.classList.add('winning'), 120);
  const lastPage = save.cur === PAGES.length - 1;
  setTimeout(() => {
    if (lastPage) showEnd();
    else load(save.cur + 1);
  }, 900);
}

// ---------- 操作 ----------
let lastAct = 0;
function doAct(a: { t: 'move'; dir: Dir } | { t: 'split' }) {
  if (locked || !s || s.won || overlayOpen()) return;
  const now = performance.now();
  if (now - lastAct < 85) return;
  lastAct = now;
  const before = cloneState(s);
  const ev = act(s, a);
  if (changed(ev)) {
    hist.push(before);
    if (hist.length > 600) hist.shift();
    if (!moved && save.cur === 0 && hintAt === 1) setHint(''); // “往右走走看”已经用不着了
    moved = true;
  }
  play(ev);
}
function undo() {
  if (locked || overlayOpen()) return;
  const p = hist.pop();
  if (!p) return void sfx.nope();
  s = p;
  sfx.split('一');
  rebuild();
}
function reset() {
  if (locked || overlayOpen()) return;
  if (!hist.length) return;
  const first = hist[0];
  hist.push(cloneState(s)); // 重写也能悔
  s = cloneState(first);
  sfx.page();
  rebuild();
}
function toggleMute() {
  save.mute = !save.mute;
  sfx.setMuted(save.mute);
  persist();
  drawNav();
}

const overlayOpen = () => !$('dict').hidden || !$('end').hidden;
function showDict() {
  const n = save.found.length;
  $('dictSum').textContent = `认得 ${n} 个，还有 ${ALL_FOUND.length - n} 个空着。印盖了 ${save.seals.length} 方，共 ${Object.keys(IDIOM).length} 方。`;
  $('dictList').innerHTML = ALL_FOUND.map((ch) =>
    save.found.includes(ch) ? `<div class="entry"><b>${ch}</b><span>${GLOSS[ch]}</span></div>` : `<div class="entry no"><b>？</b><span></span></div>`
  ).join('');
  $('sealList').innerHTML = Object.keys(IDIOM)
    .map((k) => (save.seals.includes(k) ? `<div class="mini">${[...IDIOM[k]].map((c) => `<span>${c}</span>`).join('')}</div>` : `<div class="mini no"></div>`))
    .join('');
  $('dict').hidden = false;
}
function showEnd() {
  save.done = true;
  persist();
  const n = save.found.length;
  const left = ALL_FOUND.length - n;
  $('endText').innerHTML =
    `这一本写完了。<br>你用一个“人”字，拼出了 ${n} 个字，盖了 ${save.seals.length} 方印。` +
    (left > 0 ? `<br>字典里还有 ${left} 个字空着——白页上的笔画都还在。` : `<br>字典满了。这些字现在都是你的。`);
  $('endChars').textContent = ALL_FOUND.filter((c) => save.found.includes(c)).join('');
  $('end').hidden = false;
  sfx.finale();
}
function closeOverlays() {
  $('dict').hidden = true;
  if (!$('end').hidden) {
    $('end').hidden = true;
    load(PAGES.length - 1, false);
  }
}

const DIRS: Record<string, Dir> = {
  ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3,
  d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3, l: 0, j: 1, h: 2, k: 3,
};
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  sfx.wake();
  const k = e.key;
  if (k === 'Tab') {
    e.preventDefault();
    if (overlayOpen()) closeOverlays();
    else showDict();
    return;
  }
  if (overlayOpen()) {
    if (k === 'Escape' || k === 'Enter' || k === ' ') {
      e.preventDefault();
      closeOverlays();
    }
    return;
  }
  if (k in DIRS && !(k === 'h' || k === 'H')) {
    e.preventDefault();
    doAct({ t: 'move', dir: DIRS[k] });
  } else if (k === ' ' || k === 'Enter' || k === 'x' || k === 'X') {
    e.preventDefault();
    if (!e.repeat) doAct({ t: 'split' });
  } else if (k === 'z' || k === 'Z' || k === 'u' || k === 'U' || k === 'Backspace') {
    e.preventDefault();
    undo();
  } else if (k === 'r' || k === 'R') {
    if (!e.repeat) reset();
  } else if (k === 'm' || k === 'M') toggleMute();
  else if (k === 'h' || k === 'H' || k === '?' || k === '？') {
    if (!e.repeat && !locked) nextHint();
  } else if (k === '[' || k === 'PageUp') {
    if (save.cur > 0 && !locked) load(save.cur - 1);
  } else if (k === ']' || k === 'PageDown') {
    if (save.cur < save.max && !locked) load(save.cur + 1);
  }
});

// 触屏：滑动是走，轻点是拆
let tp: { x: number; y: number; t: number } | null = null;
const stage = $('stage');
stage.addEventListener('pointerdown', (e) => {
  sfx.wake();
  tp = { x: e.clientX, y: e.clientY, t: performance.now() };
});
stage.addEventListener('pointerup', (e) => {
  if (!tp) return;
  const dx = e.clientX - tp.x;
  const dy = e.clientY - tp.y;
  const far = Math.hypot(dx, dy);
  if (far > 22) doAct({ t: 'move', dir: (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3) as Dir });
  else if (e.pointerType !== 'mouse' && performance.now() - tp.t < 400) doAct({ t: 'split' });
  tp = null;
});
const click = (id: string, fn: () => void) =>
  $(id).addEventListener('click', (e) => {
    sfx.wake();
    fn();
    (e.currentTarget as HTMLElement).blur();
  });
click('kSplit', () => doAct({ t: 'split' }));
click('kUndo', undo);
click('kReset', reset);
click('hintBtn', () => !locked && nextHint());
click('dictBtn', showDict);
click('muteBtn', toggleMute);
click('dictClose', closeOverlays);
click('endBack', closeOverlays);
click('endAgain', () => {
  $('end').hidden = true;
  load(0, false);
});
for (const id of ['dict', 'end']) $(id).addEventListener('click', (e) => e.target === e.currentTarget && closeOverlays());

if (matchMedia('(pointer: coarse)').matches) {
  $('kMove').innerHTML = '<kbd class="cjk">滑动</kbd><i>走</i>';
  $('kSplit').innerHTML = '<kbd class="cjk">轻点</kbd><i>拆</i>';
  $('kUndo').innerHTML = '<kbd class="cjk">悔一步</kbd>';
  $('kReset').innerHTML = '<kbd class="cjk">重写这页</kbd>';
}

addEventListener('resize', () => s && layout());
sfx.setMuted(save.mute);
load(save.cur, false);
requestAnimationFrame(frame);
// 字体到了以后量一遍尺寸，免得第一帧用后备字体排版
void document.fonts?.ready.then(() => s && layout());
