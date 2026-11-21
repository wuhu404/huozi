# 活字

一页纸，一个“人”字，和几个别的字。

## 打开

- 直接玩：打开 `docs/index.html`（双击即可，也可以放在任何静态服务器或 GitHub Pages 的仓库子路径下）。
- 开发：`npm install`，然后 `npm run dev`。

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

## 构建与检查

```
npm test          # 规则引擎的回放与可解性检查
npm run build     # 类型检查 + 产出 docs/
npm run play      # 无头浏览器把 docs/ 从第一页玩到跋（需先在仓库根目录起一个静态服务器，端口 4173）
npm run font      # 改了界面文字或加了新字以后重新裁字体
```

`docs/` 是编译产物，全部用相对路径，提交后在 GitHub Pages 里选 “Deploy from a branch → /docs” 即可。

## 字体

界面用的是 [霞鹜文楷](https://github.com/lxgw/LxgwWenKai)（SIL Open Font License 1.1）裁出的子集。
