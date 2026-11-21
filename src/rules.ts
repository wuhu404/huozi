// 纯规则：不碰 DOM，不碰时间。给一个状态和一次按键，改状态，吐出发生了什么。
import { LIGHT, MERGE, PARTS, formOf, isExit, isFire, isFixed, isHeavy, sinks } from './glyphs.ts';
import type { Form } from './glyphs.ts';

export type Dir = 0 | 1 | 2 | 3; // 右 下 左 上
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export const FLOOR = 0;
export const VOID = 1;
export const WATER = 2;
export const FILLED = 3;

export interface Glyph {
  ch: string;
  a?: Glyph; // 留在原地的那一半
  b?: Glyph; // 后来加进来、拆的时候先出去的那一半
}
export interface Ent {
  id: number;
  g: Glyph;
  x: number;
  y: number;
  you?: boolean;
}
export interface State {
  w: number;
  h: number;
  terr: number[];
  ents: Ent[];
  night: boolean;
  facing: Dir;
  nextId: number;
  sleep: number;
  won: boolean;
  sx: number;
  sy: number;
}

export type Ev =
  | { t: 'move'; id: number; fx: number; fy: number; x: number; y: number; how: 'walk' | 'push' | 'blink' | 'fly' | 'float' | 'tele' | 'hop' }
  | { t: 'bump'; dir: Dir; why: 'edge' | 'water' | 'void' | 'heavy' | 'block' | 'jail' | 'dark' }
  | { t: 'merge'; id: number; gone: number; x: number; y: number; ch: string; part: string; fx: number; fy: number; you: boolean }
  | { t: 'spawn'; id: number; fx: number; fy: number; x: number; y: number }
  | { t: 'split'; id: number; ch: string; x: number; y: number }
  | { t: 'gone'; id: number; x: number; y: number; how: 'sink' | 'fizz' | 'burn' | 'eat'; ch: string; wave: number; fx: number; fy: number }
  | { t: 'char'; id: number; ch: string; x: number; y: number; wave: number }
  | { t: 'terr'; x: number; y: number }
  | { t: 'zzz' }
  | { t: 'time'; night: boolean; by: 'sleep' | 'dawn' }
  | { t: 'idiom'; key: string }
  | { t: 'hint' }
  | { t: 'nosplit'; why: 'none' | 'stuck' }
  | { t: 'win'; x: number; y: number };

export type Action = { t: 'move'; dir: Dir } | { t: 'split' };

export function cloneState(s: State): State {
  return {
    ...s,
    terr: s.terr.slice(),
    ents: s.ents.map((e) => ({ ...e })), // 字形树是不可变的，可以共用
  };
}

export const inb = (s: State, x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const terrAt = (s: State, x: number, y: number) => s.terr[y * s.w + x];
export const entAt = (s: State, x: number, y: number) => s.ents.find((e) => e.x === x && e.y === y);
export const you = (s: State) => s.ents.find((e) => e.you)!;

/** 夜里，这一格有没有被哪个发光的字照到。白天处处都亮。 */
export function lit(s: State, x: number, y: number): boolean {
  if (!s.night) return true;
  return s.ents.some((e) => {
    const r = LIGHT[e.g.ch];
    return r !== undefined && Math.hypot(e.x - x, e.y - y) <= r;
  });
}

function legal(f: Form, t: number): boolean {
  if (t === FLOOR || t === FILLED) return true;
  if (t === WATER) return !!(f.floats || f.flies);
  return !!f.flies;
}

function remove(s: State, e: Ent) {
  s.ents.splice(s.ents.indexOf(e), 1);
}

/**
 * 把一个字放到 (x,y)。ent 为空表示这是刚拆出来的新字。
 * 只在确定能成的时候才动状态，所以失败不留痕迹。
 */
function place(s: State, ev: Ev[], g: Glyph, x: number, y: number, dir: Dir, strong: boolean, ent: Ent | null, fx: number, fy: number): boolean {
  if (!inb(s, x, y)) return false;
  const t = terrAt(s, x, y);
  if (t === VOID) return false;
  const f = entAt(s, x, y);
  if (f) {
    if (isExit(f.g.ch)) return false;
    const r = MERGE.get(g.ch + f.g.ch);
    if (r) {
      if (ent) remove(s, ent);
      f.g = { ch: r, a: f.g, b: g };
      ev.push({ t: 'merge', id: f.id, gone: ent ? ent.id : -1, x, y, ch: r, part: g.ch, fx, fy, you: !!f.you });
      return true;
    }
    if (strong && ent && !f.you) {
      if (!push(s, ev, f, dir, true)) return false;
      ev.push({ t: 'idiom', key: 'chain' });
      ent.x = x;
      ent.y = y;
      ev.push({ t: 'move', id: ent.id, fx, fy, x, y, how: 'push' });
      return true;
    }
    return false;
  }
  if (t === WATER) {
    if (sinks(g.ch)) {
      const id = ent ? ent.id : -1;
      if (ent) remove(s, ent);
      s.terr[y * s.w + x] = FILLED;
      ev.push({ t: 'gone', id, x, y, how: 'sink', ch: g.ch, wave: 0, fx, fy });
      ev.push({ t: 'terr', x, y });
      ev.push({ t: 'idiom', key: g.ch === '石' ? 'stone' : 'fill' });
      return true;
    }
    if (g.ch === '木') {
      s.terr[y * s.w + x] = FLOOR;
      const e = ent ?? { id: s.nextId++, g, x, y };
      if (!ent) s.ents.push(e);
      e.g = { ch: '沐' };
      e.x = x;
      e.y = y;
      ev.push({ t: 'terr', x, y });
      ev.push({ t: 'merge', id: e.id, gone: -1, x, y, ch: '沐', part: '木', fx, fy, you: false });
      return true;
    }
    if (isFire(g.ch)) {
      const id = ent ? ent.id : -1;
      if (ent) remove(s, ent);
      ev.push({ t: 'gone', id, x, y, how: 'fizz', ch: g.ch, wave: 0, fx, fy });
      ev.push({ t: 'idiom', key: 'fizz' });
      return true;
    }
    return false;
  }
  if (ent) {
    ent.x = x;
    ent.y = y;
    ev.push({ t: 'move', id: ent.id, fx, fy, x, y, how: 'push' });
  } else {
    const e: Ent = { id: s.nextId++, g, x, y };
    s.ents.push(e);
    ev.push({ t: 'spawn', id: e.id, fx, fy, x, y });
  }
  return true;
}

function push(s: State, ev: Ev[], e: Ent, dir: Dir, strong: boolean): boolean {
  if (isFixed(e.g.ch)) return false;
  if (isHeavy(e.g.ch) && !strong) return false;
  return place(s, ev, e.g, e.x + DX[dir], e.y + DY[dir], dir, strong, e, e.x, e.y);
}

/** 试着做一件可能半途而废的事；不成就当没发生。 */
function attempt(s: State, ev: Ev[], fn: (d: State, e: Ev[]) => boolean): boolean {
  const d = cloneState(s);
  const e: Ev[] = [];
  if (!fn(d, e)) return false;
  Object.assign(s, d);
  ev.push(...e);
  return true;
}

function move(s: State, ev: Ev[], dir0: Dir) {
  const p = you(s);
  const f = formOf(p.g.ch);
  const dir = (f.invert ? (dir0 + 2) % 4 : dir0) as Dir;
  s.facing = dir;
  if (f.immobile) {
    if (p.g.ch === '休') {
      s.sleep++;
      ev.push({ t: 'zzz' });
      if (s.sleep % 3 === 0) {
        s.night = !s.night;
        ev.push({ t: 'time', night: s.night, by: 'sleep' });
        ev.push({ t: 'idiom', key: s.night ? 'dusk' : 'dawn' });
      }
    } else {
      ev.push({ t: 'bump', dir, why: 'jail' });
      ev.push({ t: 'idiom', key: 'jail' });
    }
    return;
  }
  const n = f.blink ? 2 : 1;
  const tx = p.x + DX[dir] * n;
  const ty = p.y + DY[dir] * n;
  if (!inb(s, tx, ty)) return void ev.push({ t: 'bump', dir, why: 'edge' });
  const t = terrAt(s, tx, ty);
  const e = entAt(s, tx, ty);
  // 黑处不敢落脚；但摸得到的字，摸黑也能碰。
  if (!e && !lit(s, tx, ty)) {
    ev.push({ t: 'bump', dir, why: 'dark' });
    return void ev.push({ t: 'idiom', key: 'dark' });
  }
  const how = f.blink ? 'blink' : f.flies ? 'fly' : f.floats ? 'float' : 'walk';
  const go = () => {
    ev.push({ t: 'move', id: p.id, fx: p.x, fy: p.y, x: tx, y: ty, how });
    p.x = tx;
    p.y = ty;
    if (f.blink) ev.push({ t: 'idiom', key: 'blink' });
    if (f.flies && t === VOID) ev.push({ t: 'idiom', key: 'sky' });
  };
  if (e && isExit(e.g.ch)) {
    go();
    s.won = true;
    ev.push({ t: 'win', x: tx, y: ty });
    return;
  }
  if (!legal(f, t)) return void ev.push({ t: 'bump', dir, why: t === WATER ? 'water' : 'void' });
  if (!e) return go();

  const r = MERGE.get(p.g.ch + e.g.ch);
  if (r) {
    if (!lit(s, tx, ty)) ev.push({ t: 'idiom', key: 'grope' });
    remove(s, e);
    const fx = p.x;
    const fy = p.y;
    p.g = { ch: r, a: p.g, b: e.g };
    p.x = tx;
    p.y = ty;
    ev.push({ t: 'move', id: p.id, fx, fy, x: tx, y: ty, how: 'walk' });
    ev.push({ t: 'merge', id: p.id, gone: e.id, x: tx, y: ty, ch: r, part: e.g.ch, fx: tx, fy: ty, you: true });
    return;
  }
  if (f.eats) {
    remove(s, e);
    ev.push({ t: 'gone', id: e.id, x: tx, y: ty, how: 'eat', ch: e.g.ch, wave: 0, fx: tx, fy: ty });
    ev.push({ t: 'idiom', key: 'eat' });
    return go();
  }
  if (e.g.ch === '回' && !(p.x === s.sx && p.y === s.sy) && !entAt(s, s.sx, s.sy)) {
    ev.push({ t: 'move', id: p.id, fx: p.x, fy: p.y, x: s.sx, y: s.sy, how: 'tele' });
    ev.push({ t: 'idiom', key: 'back' });
    p.x = s.sx;
    p.y = s.sy;
    return;
  }
  if (e.g.ch === '问') {
    ev.push({ t: 'hint' });
    return void ev.push({ t: 'bump', dir, why: 'block' });
  }
  if (f.blink || f.flies) return void ev.push({ t: 'bump', dir, why: 'block' });
  if (push(s, ev, e, dir, !!f.strong)) return go();
  ev.push({ t: 'bump', dir, why: isHeavy(e.g.ch) && !f.strong ? 'heavy' : 'block' });
}

function split(s: State, ev: Ev[]) {
  const p = you(s);
  const d = s.facing;
  s.sleep = 0;
  if (p.g.a && p.g.b) {
    const a = p.g.a;
    const b = p.g.b;
    const fa = formOf(a.ch);
    const cx = p.x;
    const cy = p.y;
    // 一：人留在原地，把那一半朝前递出去。
    const toss = (dir: Dir) =>
      attempt(s, ev, (ds, de) => {
        if (!legal(fa, terrAt(ds, cx, cy))) return false;
        you(ds).g = a;
        de.push({ t: 'split', id: p.id, ch: a.ch, x: cx, y: cy });
        return place(ds, de, b, cx + DX[dir], cy + DY[dir], dir, false, null, cx, cy);
      });
    // 二：那一半留在脚下，人往后（或往前）迈一步。
    const step = (dir: Dir) =>
      attempt(s, ev, (ds, de) => {
        const nx = cx + DX[dir];
        const ny = cy + DY[dir];
        if (!inb(ds, nx, ny) || entAt(ds, nx, ny) || !legal(fa, terrAt(ds, nx, ny))) return false;
        const q = you(ds);
        q.g = a;
        q.x = nx;
        q.y = ny;
        de.push({ t: 'split', id: p.id, ch: a.ch, x: cx, y: cy });
        de.push({ t: 'move', id: p.id, fx: cx, fy: cy, x: nx, y: ny, how: 'hop' });
        return place(ds, de, b, cx, cy, dir, false, null, cx, cy);
      });
    const back = ((d + 2) % 4) as Dir;
    const left = ((d + 3) % 4) as Dir;
    const right = ((d + 1) % 4) as Dir;
    if (toss(d) || step(back) || step(d) || toss(left) || toss(right) || step(left) || step(right)) return;
    ev.push({ t: 'nosplit', why: 'stuck' });
    return;
  }
  // 自己是个光杆的人：试着拆面前的字。
  const fx = p.x + DX[d];
  const fy = p.y + DY[d];
  const e = inb(s, fx, fy) ? entAt(s, fx, fy) : undefined;
  if (!e || !e.g.a || !e.g.b) return void ev.push({ t: 'nosplit', why: 'none' });
  const a = e.g.a;
  const b = e.g.b;
  for (const dir of [d, (d + 1) % 4, (d + 3) % 4] as Dir[]) {
    const ok = attempt(s, ev, (ds, de) => {
      const q = entAt(ds, fx, fy)!;
      q.g = a;
      de.push({ t: 'split', id: q.id, ch: a.ch, x: fx, y: fy });
      return place(ds, de, b, fx + DX[dir], fy + DY[dir], dir, false, null, fx, fy);
    });
    if (ok) return;
  }
  ev.push({ t: 'nosplit', why: 'stuck' });
}

const hasWood = (g: Glyph): boolean => g.ch === '木' || (g.ch !== '沐' && !!g.a && !!g.b && (hasWood(g.a) || hasWood(g.b)));

/** 烧掉字里的木头，剩下什么算什么。 */
function burnt(g: Glyph): Glyph | null {
  if (g.ch === '木') return null;
  if (!g.a || !g.b) return g;
  const a = burnt(g.a);
  const b = burnt(g.b);
  if (a === g.a && b === g.b) return g;
  if (!a) return b;
  if (!b) return a;
  const r = MERGE.get(a.ch + b.ch);
  return r ? { ch: r, a, b } : a;
}

function settle(s: State, ev: Ev[]) {
  // 火：挨着木头就烧，烧着的木头再点着旁边的。
  let front = s.ents.filter((e) => isFire(e.g.ch)).map((e) => [e.x, e.y]);
  let wave = 0;
  let burned = false;
  while (front.length) {
    const next: number[][] = [];
    for (const e of s.ents.slice()) {
      if (!hasWood(e.g)) continue;
      if (!front.some(([x, y]) => Math.abs(x - e.x) + Math.abs(y - e.y) === 1)) continue;
      const was = e.g.ch;
      const g = burnt(e.g);
      next.push([e.x, e.y]);
      burned = true;
      if (g) {
        e.g = g;
        ev.push({ t: 'char', id: e.id, ch: g.ch, x: e.x, y: e.y, wave });
      } else {
        remove(s, e);
        ev.push({ t: 'gone', id: e.id, x: e.x, y: e.y, how: 'burn', ch: was, wave, fx: e.x, fy: e.y });
      }
    }
    front = next;
    wave++;
  }
  if (burned) ev.push({ t: 'idiom', key: 'burn' });
  if (s.night && s.ents.some((e) => e.g.ch === '旦')) {
    s.night = false;
    ev.push({ t: 'time', night: false, by: 'dawn' });
  }
}

export function act(s: State, a: Action): Ev[] {
  const ev: Ev[] = [];
  if (s.won) return ev;
  if (a.t === 'move') move(s, ev, a.dir);
  else split(s, ev);
  settle(s, ev);
  return ev;
}

/** 这一步有没有真的改变什么（决定要不要记进“悔”的历史）。 */
export const changed = (ev: Ev[]) => ev.some((e) => e.t !== 'bump' && e.t !== 'nosplit' && e.t !== 'hint' && e.t !== 'idiom');

/** 关卡里直接写出来的合成字，也按它的来历拆得开、烧得着。 */
export function grow(ch: string): Glyph {
  const p = PARTS.get(ch);
  return p ? { ch, a: grow(p[0]), b: grow(p[1]) } : { ch };
}

export function parseLevel(rows: string[], night = false): State {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const s: State = { w, h, terr: new Array(w * h).fill(VOID), ents: [], night, facing: 0, nextId: 1, sleep: 0, won: false, sx: 0, sy: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const c = rows[y][x];
      const i = y * w + x;
      if (c === 'x' || c === ' ') continue;
      if (c === '~') {
        s.terr[i] = WATER;
        continue;
      }
      s.terr[i] = FLOOR;
      if (c === '·') continue;
      if (c === '我') {
        s.ents.push({ id: s.nextId++, g: { ch: '人' }, x, y, you: true });
        s.sx = x;
        s.sy = y;
      } else s.ents.push({ id: s.nextId++, g: grow(c), x, y });
    }
  }
  return s;
}

export function show(s: State): string {
  const out: string[] = [];
  for (let y = 0; y < s.h; y++) {
    let r = '';
    for (let x = 0; x < s.w; x++) {
      const e = entAt(s, x, y);
      const t = terrAt(s, x, y);
      r += e ? e.g.ch : t === VOID ? '　' : t === WATER ? '水' : t === FILLED ? '＿' : '・';
    }
    out.push(r);
  }
  return out.join('\n');
}
