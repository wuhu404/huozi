import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// 产物是一个普通的（非 module）脚本：这样 dist/index.html 既能放在
// GitHub Pages 的 /<仓库名>/ 子路径下，也能直接双击用 file:// 打开。
const classicScript = (): Plugin => ({
  name: 'classic-script',
  enforce: 'post',
  transformIndexHtml: (html) => html.replace(/<script type="module" crossorigin/g, '<script defer').replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"'),
});

export default defineConfig({
  // 相对路径：不管仓库叫什么、挂在哪个子路径下（/huozi/ 或自定义域名的根）都能找到资源。
  base: './',
  plugins: [classicScript()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife' } },
  },
});
