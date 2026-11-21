// 手机尺寸 + 触屏：滑动走、轻点拆。node tools/touch.mjs [url]
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/docs/';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/home/ubuntu/.local/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`console.${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
const cdp = await ctx.newCDPSession(page);
const touch = async (x0, y0, x1, y1) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  if (x0 !== x1 || y0 !== y1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1, y: y1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(160);
};
const swipe = { r: [150, 300, 250, 300], l: [250, 300, 150, 300], d: [200, 250, 200, 350], u: [200, 350, 200, 250] };
const go = async (keys) => {
  for (const k of keys) await (k === 's' ? touch(200, 300, 200, 300) : touch(...swipe[k]));
};
const me = () => page.evaluate(() => document.querySelector('.ent.you')?.dataset.ch);
const expect = (ok, what) => {
  console.log((ok ? '  ok  ' : ' FAIL ') + what);
  if (!ok) problems.push('expect: ' + what);
};

await page.goto(url);
await page.waitForSelector('.ent.you');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/m1-open.png' });
const fits = await page.evaluate(() => {
  const r = document.getElementById('sheet').getBoundingClientRect();
  return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
});
expect(fits, 'sheet fits a 390px screen');
await go('rrr');
expect((await me()) === '休', 'swipe → 休');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/m2-xiu.png' });
await go('s');
expect((await me()) === '人', 'tap → 人');
await page.tap('#kUndo');
await page.waitForTimeout(200);
expect((await me()) === '休', 'undo button');
await page.tap('#dictBtn');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/m3-dict.png' });
await page.tap('#dictClose');
await page.evaluate(() => { localStorage.clear(); });
await page.goto(url);
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem(Object.keys(localStorage)[0]) ?? '{}'); return s; });
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no console errors, no failed requests');
await browser.close();
process.exit(problems.length ? 1 : 0);
