#!/usr/bin/env python3
"""把霞鹜文楷裁成只含游戏用到的字的 woff2。

用法：把 LXGWWenKai-Medium.ttf 放到 tools/font/ 下，然后 npm run font。
改了任何界面文字或加了新字以后都要重新跑一遍。
"""
import glob
import os
import subprocess
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, 'tools', 'font', 'LXGWWenKai-Medium.ttf')
out = os.path.join(root, 'src', 'assets', 'wenkai.woff2')
if not os.path.exists(src):
    sys.exit('缺少 ' + src + '（从 https://github.com/lxgw/LxgwWenKai/releases 下载）')

chars = set()
for f in glob.glob(os.path.join(root, 'src', '*.ts')) + [os.path.join(root, 'index.html')]:
    with open(f, encoding='utf-8') as fh:
        chars.update(c for c in fh.read() if ord(c) > 0x2000)
chars.update('0123456789/ ？。，、！“”——…·')
text = ''.join(sorted(chars))
subprocess.check_call([
    sys.executable, '-m', 'fontTools.subset', src,
    '--text=' + text, '--flavor=woff2', '--output-file=' + out,
    '--layout-features=', '--no-hinting', '--desubroutinize',
])
print(f'{len(chars)} 个字 -> {out} ({os.path.getsize(out) / 1024:.0f} KB)')
