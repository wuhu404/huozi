// 字的全部知识：谁和谁合成什么、各自是什么脾气、第一次见到时说什么。

export const MERGE = new Map<string, string>();
const PAIRS: Array<[string, string, string]> = [
  // 与人有关
  ['人', '木', '休'], ['人', '一', '大'], ['大', '一', '天'], ['人', '二', '天'],
  ['人', '山', '仙'], ['人', '门', '闪'], ['人', '口', '囚'], ['人', '火', '伙'],
  ['人', '人', '从'], ['从', '人', '众'], ['人', '本', '体'], ['人', '旦', '但'],
  ['天', '口', '吞'],
  // 物与物
  ['木', '木', '林'], ['林', '木', '森'], ['木', '一', '本'],
  ['一', '一', '二'], ['二', '一', '三'],
  ['口', '一', '日'], ['日', '一', '旦'], ['日', '月', '明'],
  ['日', '日', '昌'], ['昌', '日', '晶'], ['月', '月', '朋'],
  ['口', '口', '回'], ['回', '口', '品'], ['口', '木', '困'],
  ['门', '口', '问'], ['门', '日', '间'], ['门', '木', '闲'], ['门', '一', '闩'],
  ['一', '火', '灭'], ['火', '火', '炎'], ['炎', '火', '焱'],
  ['山', '山', '出'], ['山', '石', '岩'], ['山', '火', '灿'],
];
/** 反过来：一个合成字原本是哪两半（取表里最先出现的那种拼法）。 */
export const PARTS = new Map<string, [string, string]>();
for (const [a, b, r] of PAIRS) {
  MERGE.set(a + b, r);
  MERGE.set(b + a, r);
  if (!PARTS.has(r)) PARTS.set(r, [a, b]);
}

export const PRIMITIVES = '人木一山石门口月火';

const HEAVY = new Set('山石岩森闩灿');
const FIXED = new Set('。出');
const EXIT = new Set('。出');
const FIRE = new Set('火炎焱伙');
const SINKS = new Set('山石岩灿');

export const isHeavy = (ch: string) => HEAVY.has(ch);
export const isFixed = (ch: string) => FIXED.has(ch);
export const isExit = (ch: string) => EXIT.has(ch);
export const isFire = (ch: string) => FIRE.has(ch);
export const sinks = (ch: string) => SINKS.has(ch);

/** 夜里能照多远（单位：格）。 */
export const LIGHT: Record<string, number> = {
  日: 2.7, 月: 1.9, 明: 99, 昌: 3.6, 晶: 4.8, 朋: 2.8, 间: 1.7,
  火: 1.7, 炎: 2.4, 焱: 3.2, 伙: 2.3, 灿: 4.4, 闪: 1.6, 旦: 3,
};

export interface Form {
  immobile?: boolean; // 动不了
  strong?: boolean; // 推得动重的，也推得动一串
  floats?: boolean; // 过水
  flies?: boolean; // 过水，也过没有格子的白纸
  blink?: boolean; // 一步两格
  invert?: boolean; // 反着走
  eats?: boolean; // 撞什么吃什么
}
const FORMS: Record<string, Form> = {
  休: { immobile: true },
  囚: { immobile: true },
  大: { strong: true },
  体: { strong: true },
  众: { strong: true },
  天: { flies: true },
  仙: { floats: true },
  闪: { blink: true },
  但: { invert: true },
  吞: { eats: true },
};
const PLAIN: Form = {};
export const formOf = (ch: string): Form => FORMS[ch] ?? PLAIN;

/** 第一次得到某个字时，页脚的一句话。 */
export const GLOSS: Record<string, string> = {
  休: '人靠着树，就不想走了。',
  大: '人张开双臂。力气也大了。',
  天: '大字头上再添一横。地上的格子管不着了。',
  仙: '人在山边，脚不沾水。',
  闪: '门里一个人，一步跨两格。',
  囚: '人进了口，出不来。',
  伙: '人举着火。离木头远点。',
  从: '一个跟着一个。',
  众: '三人成众，众志移山。',
  体: '人有了根本，站得稳。',
  但: '但是——凡事反着来。',
  吞: '天大的口，什么都吃。',
  林: '独木不成林。两棵就成了。',
  森: '三木成森。推不动了。',
  本: '木下一横，是根。',
  二: '一加一。',
  三: '二加一。再加就没有了。',
  日: '口里含一横，亮了。',
  旦: '日出地平线。天亮了。',
  明: '日月同辉，无处不亮。',
  昌: '两个太阳，亮得过分。',
  晶: '三日成晶。',
  朋: '两个月亮，做个朋友。',
  回: '口中有口。碰它，就回到来处。',
  品: '三张嘴，评头论足。',
  困: '树长在框里，伸不开。',
  问: '门里一张嘴。有事可以问它。',
  间: '门缝里漏进一点日光。',
  闲: '门里长了树，许久没人走。',
  闩: '门上横一道，谁也推不开。',
  灭: '一横压住了火。',
  炎: '火上加火。',
  焱: '三把火。',
  灿: '火照山头，十里通明。',
  出: '山外有山，便是出路。',
  岩: '山下压着石头。',
  沐: '木头泡了水，点不着了。',
};
export const ALL_FOUND = Object.keys(GLOSS);

/** 不是字，是事：第一次发生时给一个四字的注脚。 */
export const IDIOM: Record<string, string> = {
  fill: '移山填海',
  stone: '石沉大海',
  fizz: '水火不容',
  burn: '付之一炬',
  dusk: '日入而息',
  dawn: '日出而作',
  sky: '天马行空',
  jail: '画地为牢',
  blink: '一闪而过',
  chain: '力大无穷',
  eat: '囫囵吞枣',
  back: '回头是岸',
  dark: '寸步难行',
  grope: '暗中摸索',
};
