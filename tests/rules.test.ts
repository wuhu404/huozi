import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, cloneState, parseLevel, show, you, entAt } from '../src/rules.ts';
import type { Action, Dir, State } from '../src/rules.ts';
import { PAGES } from '../src/levels.ts';
import { ALL_FOUND, GLOSS, IDIOM, MERGE } from '../src/glyphs.ts';

const KEY: Record<string, Action> = {
  r: { t: 'move', dir: 0 }, d: { t: 'move', dir: 1 }, l: { t: 'move', dir: 2 }, u: { t: 'move', dir: 3 }, s: { t: 'split' },
};
function run(s: State, keys: string) {
  for (const k of keys) act(s, KEY[k]);
  return s;
}
const load = (i: number) => parseLevel(PAGES[i].rows, PAGES[i].night);

function key(s: State) {
  return s.ents.map((e) => `${e.g.ch}${e.you ? '*' : ''}${e.x},${e.y}`).sort().join('|') + '#' + s.terr.join('') + s.facing + (s.night ? 'n' : 'd') + (s.sleep % 3);
}
/** 广搜最短解。goal 默认是过关。 */
function solve(s0: State, goal: (s: State) => boolean = (s) => s.won, limit = 400000): string | null {
  const seen = new Set([key(s0)]);
  let q: Array<[State, string]> = [[s0, '']];
  while (q.length) {
    const nq: Array<[State, string]> = [];
    for (const [s, path] of q) {
      for (const k of 'rdlus') {
        const n = cloneState(s);
        act(n, KEY[k]);
        if (goal(n)) return path + k;
        if (n.won) continue;
        const kk = key(n);
        if (seen.has(kk)) continue;
        seen.add(kk);
        if (seen.size > limit) return null;
        nq.push([n, path + k]);
      }
    }
    q = nq;
  }
  return null;
}

test('rows are rectangular', () => {
  for (const p of PAGES) for (const r of p.rows) assert.equal(r.length, p.rows[0].length, `${p.name}: ${r}`);
});

test('every merge result has a gloss', () => {
  for (const r of new Set(MERGE.values())) assert.ok(GLOSS[r], r);
  assert.ok(ALL_FOUND.includes('沐'));
});

test('page 1: bump, split, forest', () => {
  const s = load(0);
  run(s, 'rrr');
  assert.equal(you(s).g.ch, '休');
  run(s, 'rrr');
  assert.equal(you(s).x, 3, 'asleep, cannot move');
  assert.equal(s.night, true, 'three nudges while asleep and night falls');
  const n = cloneState(s);
  run(n, 'sl');
  assert.equal(you(n).x, 3, 'too dark to walk');
  run(n, 'rrrr');
  assert.equal(you(n).g.ch, '休', 'but the tree is right there');
  assert.equal(n.night, false, 'slept until morning');
  run(s, 'rrr');
  assert.equal(s.night, false);
  run(s, 's');
  assert.equal(you(s).g.ch, '人');
  assert.equal(entAt(s, 4, 1)!.g.ch, '木');
  run(s, 'rs');
  assert.equal(entAt(s, 5, 1)!.g.ch, '林');
  run(s, 'rr');
  assert.equal(entAt(s, 7, 1)!.g.ch, '森');
  run(s, 'r');
  assert.equal(you(s).x, 6, 'forest is heavy');
  run(s, 'urrrdr');
  assert.ok(s.won, show(s));
});

test('page 2: immortal crosses water; mountain fills it', () => {
  const s = load(1);
  run(s, 'r');
  assert.equal(you(s).x, 1);
  run(s, 'rrrrrrr');
  assert.ok(s.won, show(s));
  const t = load(1);
  run(t, 'rrs');
  assert.equal(you(t).g.ch, '人');
  assert.equal(t.terr[1 * t.w + 3], 3, show(t));
  run(t, 'rr');
  assert.equal(you(t).x, 3, 'second water cell still blocks');
});

test('page 3: big pushes stone, sky flies over blank paper', () => {
  const s = load(2);
  run(s, 'rrr');
  assert.equal(you(s).x, 2, 'stone too heavy for 人');
  run(s, 'lur');
  assert.equal(you(s).g.ch, '大');
  run(s, 'rdrrrr');
  assert.equal(you(s).x, 6, show(s));
  run(s, 'urrd');
  assert.equal(you(s).g.ch, '天', show(s));
  run(s, 'rrr');
  assert.ok(s.won, show(s));
});

test('page 4: blink parity', () => {
  const s = load(3);
  run(s, 'rr');
  assert.equal(you(s).g.ch, '闪');
  assert.equal(you(s).x, 1, 'cannot land on blank paper');
  run(s, 'srr');
  assert.equal(you(s).x, 4);
  run(s, 'rsrrr');
  assert.ok(s.won, show(s));
});

test('page 5: fill the river, carry the fire', () => {
  const s = load(4);
  run(s, 'drrrs');
  assert.equal(s.terr[3 * s.w + 4], 3, show(s));
  run(s, 'lluul');
  assert.equal(you(s).g.ch, '伙', show(s));
  run(s, 'ddrrrrrru');
  assert.equal(entAt(s, 7, 2), undefined, show(s));
  run(s, 'rr');
  assert.ok(s.won, show(s));
});

test('page 5: fire thrown in water is lost', () => {
  const s = load(4);
  run(s, 'urrrs');
  assert.equal(you(s).g.ch, '人');
  assert.ok(!s.ents.some((e) => e.g.ch === '火'), show(s));
});

test('page 6: dark until 日 meets 月', () => {
  const s = load(5);
  run(s, 'l');
  assert.equal(you(s).x, 1, 'cannot step into the dark');
  run(s, 'r');
  assert.equal(entAt(s, 3, 1)!.g.ch, '月', 'the moon is a lamp you can push');
  run(s, 'l');
  assert.equal(you(s).x, 2, 'the light moved on, the old spot is dark now');
  run(s, 'dl');
  assert.equal(you(s).g.ch, '大', 'but you can still touch what is next to you');
  run(s, 'rrrus');
  assert.equal(entAt(s, 4, 0)!.g.ch, '日', show(s));
  const m = solve(s, (n) => n.ents.some((e) => e.g.ch === '明'));
  assert.ok(m, show(s));
  run(s, m!);
  const w = solve(s);
  assert.ok(w, show(s));
  // 没有那一横也过得去：把口扔进黑里，再摸上去。
  const dim = load(5);
  dim.ents = dim.ents.filter((e) => e.g.ch !== '一');
  const g = solve(dim);
  assert.ok(g && g.includes('s'), 'groping through the dark');
});

test('page 7: no exit until two mountains meet', () => {
  const s = load(6);
  assert.ok(!s.ents.some((e) => e.g.ch === '。'));
  run(s, 'rrrrrrrrs');
  assert.equal(entAt(s, 9, 1)!.g.ch, '出', show(s));
  run(s, 'r');
  assert.ok(s.won);
});

test('shortest solutions exist for the authored pages', () => {
  for (const i of [0, 1, 2, 3, 6]) {
    const p = solve(load(i));
    assert.ok(p, `page ${i + 1} unsolvable`);
    console.log(`page ${i + 1}: ${p!.length} steps  ${p}`);
  }
});

test('sandbox oddities', () => {
  const a = run(load(7), 'u' + 'r'.repeat(8) + 'durrdd' + 'l'.repeat(6) + 'd');
  assert.equal(you(a).g.ch, '吞', show(a));
  run(a, 'll');
  assert.equal(entAt(a, 3, 3)!.you, true, 'ate the next mouth');
  assert.equal(a.ents.filter((e) => e.g.ch === '口').length, 1);
  run(a, 's');
  assert.equal(you(a).g.ch, '天', show(a));

  const b = run(load(7), 'd' + 'rrrrr' + 'dddd' + 'rdurrd');
  assert.equal(you(b).g.ch, '众', show(b));

  const c = run(load(7), 'u' + 'r'.repeat(8) + 'd' + 'dlllld' + 's');
  assert.equal(entAt(c, 5, 4)!.g.ch, '日', show(c));
  run(c, 'rdddrrru' + 'dllluul' + 's');
  assert.equal(entAt(c, 4, 4)!.g.ch, '旦', show(c));
  run(c, 'l');
  assert.equal(you(c).g.ch, '但', show(c));
  const x = you(c).x;
  run(c, 'l');
  assert.equal(you(c).x, x + 1, 'inverted');
  // 拆面前的字
  const d = run(load(0), 'rrrsrs');
  assert.equal(entAt(d, 5, 1)!.g.ch, '林');
  run(d, 's');
  assert.equal(entAt(d, 5, 1)!.g.ch, '木', show(d));
  assert.equal(entAt(d, 6, 1)!.g.ch, '木', show(d));
});

test('fire spreads through wood and wakes a sleeper', () => {
  const s = parseLevel(['我火·木木木·', '·····木··']);
  run(s, 'r');
  assert.equal(you(s).g.ch, '伙');
  run(s, 'r');
  assert.equal(s.ents.length, 1, show(s));
});

test('every seal is four characters', () => {
  for (const [k, v] of Object.entries(IDIOM)) assert.equal([...v].length, 4, k);
});
