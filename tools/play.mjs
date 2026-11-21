// 用无头浏览器把发布版从头玩到尾：node tools/play.mjs [url]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/docs/';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/home/ubuntu/.local/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const problems = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`console.${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));

const KEYS = { r: 'ArrowRight', d: 'ArrowDown', l: 'ArrowLeft', u: 'ArrowUp', s: 'Space', z: 'z', R: 'r' };
const press = async (keys, gap = 110) => {
  for (const k of keys) {
    await page.keyboard.press(KEYS[k] ?? k);
    await page.waitForTimeout(gap);
  }
};
const me = () => page.evaluate(() => document.querySelector('.ent.you')?.dataset.ch);
const cur = () => page.evaluate(() => document.querySelector('#pages .cur')?.textContent);
const shot = (n) => page.screenshot({ path: `shots/${n}.png` });
const expect = (ok, what) => {
  console.log((ok ? '  ok  ' : ' FAIL ') + what);
  if (!ok) problems.push('expect: ' + what);
};

await page.goto(url);
await page.waitForSelector('.ent.you');
await page.waitForTimeout(600);
expect(await page.evaluate(() => document.fonts.check('40px HuoziKai')), 'font loaded');
expect((await cur()) === '一', 'opens on page 一');
await shot('01-open');
await page.waitForTimeout(4500);
await shot('02-idle-hint');

// 一：撞树、睡到天黑、拆
await press('rrr');
expect((await me()) === '休', '人+木=休');
await page.waitForTimeout(500);
await shot('03-xiu');
await press('rr');
await page.waitForTimeout(400);
await shot('04-dozing');
await press('r');
await page.waitForTimeout(1400);
await shot('05-night');
await press('rrr');
await page.waitForTimeout(1200);
await press('s');
expect((await me()) === '人', 'split back to 人');
await page.waitForTimeout(400);
await shot('06-split');
await press('rsrrr');
await page.waitForTimeout(300);
await shot('07-forest');
await press('urrrdr');
await page.waitForTimeout(1500);
expect((await cur()) === '二', 'page 二');
await shot('08-page2');

await press('rr');
await page.waitForTimeout(500);
await shot('09-xian');
await press('rrs');
await page.waitForTimeout(700);
await shot('10-fill');
await press('zz');
await page.waitForTimeout(300);
await press('rrrrrr');
await page.waitForTimeout(1500);
expect((await cur()) === '三', 'page 三');

await press('rrr');
await page.waitForTimeout(300);
await shot('11-heavy');
await press('lurrdrrrr');
await page.waitForTimeout(300);
await shot('12-da');
await press('urrd');
await page.waitForTimeout(500);
await shot('13-tian');
await press('rrr');
await page.waitForTimeout(1500);
expect((await cur()) === '四', 'page 四');

await press('rr');
await page.waitForTimeout(400);
await shot('14-shan');
await press('zz');
await press('rsrrsrrr');
await page.waitForTimeout(1500);
expect((await cur()) === '五', 'page 五');

await press('urrrs');
await page.waitForTimeout(900);
await shot('15-fizz');
await press('R');
await page.waitForTimeout(400);
await press('drrrs');
await page.waitForTimeout(600);
await press('lluul');
await page.waitForTimeout(400);
await shot('16-huo');
await press('ddrrrrrr');
await page.waitForTimeout(250);
await press('u');
await page.waitForTimeout(250);
await shot('17-burn');
await page.waitForTimeout(900);
await press('rr');
await page.waitForTimeout(1500);
expect((await cur()) === '六', 'page 六');
await shot('18-dark');

await press('l');
await page.waitForTimeout(600);
await shot('19-cant');
await press('rdl');
await page.waitForTimeout(400);
await shot('20-moon-pushed');
await press('rrrus');
await page.waitForTimeout(700);
await shot('21-sun');
await press('dlu');
await page.waitForTimeout(300);
await shot('22-before-ming');
await press('lur', 160);
await page.waitForTimeout(300);
const hasMing = await page.evaluate(() => [...document.querySelectorAll('.ent')].some((e) => e.dataset.ch === '明'));
await shot('23-ming');
console.log('  明 on board:', hasMing);
if (process.env.STOP6) {
  await browser.close();
  process.exit(0);
}

// 六 → 七
await press('dddd' + 'rrrrrrr' + 'uuu', 100);
await page.waitForTimeout(1500);
expect((await cur()) === '七', 'page 七');
await shot('24-page7');
await press('rrrrrrrr');
await page.waitForTimeout(300);
await press('s');
await page.waitForTimeout(700);
await shot('25-chu');
await press('r');
await page.waitForTimeout(1500);
expect((await cur()) === '白', 'white page');
await shot('26-white');

// 白页上随手试几样
await press('u' + 'rrrrrrrr' + 'durrdd' + 'llllll' + 'd');
expect((await me()) === '吞', '吞');
await page.waitForTimeout(500);
await shot('27-tun');
await press('ll');
await page.waitForTimeout(400);
await press('R');
await page.waitForTimeout(300);
expect((await me()) === '人', 'R rewrites the page');
await press('z');
await page.waitForTimeout(300);
expect((await me()) === '吞', 'and Z takes even that back');
await press('R');
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await shot('28-dict');
await page.keyboard.press('Tab');

// 存档：刷新以后还在白页
await page.reload();
await page.waitForSelector('.ent.you');
await page.waitForTimeout(500);
expect((await cur()) === '白', 'reload keeps the page');
expect((await page.textContent('#count')).startsWith('1'), 'reload keeps the dictionary: ' + (await page.textContent('#count')));

// 点页码回第一页，再回来
await page.click('#pages button:nth-child(1)');
await page.waitForTimeout(700);
expect((await cur()) === '一', 'nav to page 一');
await page.click('#pages button:nth-child(8)');
await page.waitForTimeout(700);

// 去句号 → 跋 → 重写
const path = 'l' + 'ddddd' + 'r'.repeat(12) + 'd';
await press(path, 90);
await page.waitForTimeout(1600);
const ended = await page.evaluate(() => !document.getElementById('end').hidden);
expect(ended, 'colophon shown');
await shot('29-end');
await page.click('#endAgain');
await page.waitForTimeout(600);
expect((await cur()) === '一', 'restart from page 一');
expect((await me()) === '人', 'fresh 人');
await shot('30-again');

console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no console errors, no failed requests');
await browser.close();
process.exit(problems.length ? 1 : 0);
