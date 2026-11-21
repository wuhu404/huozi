# 活字 Huozi

一页纸，一个“人”字，和几个别的字。一个用汉字当零件的浏览器解谜小游戏，全程约十分钟。

**在线玩：<https://wuhu404.github.io/huozi/>**

## 操作

| 键 | 作用 |
| --- | --- |
| 方向键 / WASD | 走 |
| 空格 | 学会以后才用得上 |
| Z | 悔一步 |
| R | 重写这页 |
| H | 提示（卡住了再按） |
| Tab | 字典 |
| M | 静音 |

触屏：滑动是走，轻点是空格。

## 技术栈

- TypeScript + Vite，无运行时依赖；画面是 DOM + CSS 动画加两层 Canvas。
- 声音全部由 Web Audio 运行时合成，没有音频文件。
- 规则引擎（`src/rules.ts`）是纯函数式的状态机，不碰 DOM，用 `node --test` 直接回放和搜索。
- 字体是 [霞鹜文楷](https://github.com/lxgw/LxgwWenKai)（SIL Open Font License 1.1）按用到的字裁出的子集。

## 本地开发

需要 Node.js 24。

```
npm ci
npm run dev       # 开发服务器
npm test          # 规则引擎的回放与可解性检查
npm run build     # 类型检查 + 产出 dist/
npm run font      # 改了界面文字或加了新字以后重新裁字体（需要 Python 的 fonttools、brotli，以及 tools/font/LXGWWenKai-Medium.ttf）
```

`dist/` 里全是相对路径：可以放在任何静态服务器的任何子路径下，也可以直接双击 `dist/index.html`。

`npm run play` 会用无头 Chrome 把构建产物从第一页玩到跋页（先在仓库根目录起一个静态服务器，如 `python3 -m http.server 4173`；也可以把线上地址作为参数传给 `tools/play.mjs`）。

## 部署

推送到 `main` 分支后，[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 会自动安装依赖、跑测试、构建并发布到 GitHub Pages；测试或构建失败就不会发布。也可以在 Actions 页面手动点 “Run workflow” 重新部署。

仓库的 Settings → Pages → Source 需要选 “GitHub Actions”。
