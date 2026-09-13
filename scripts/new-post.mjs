#!/usr/bin/env node
/**
 * 新建一篇文章并自动写好 frontmatter。
 *
 *   npm run new -- blog 我的第一篇随笔
 *   npm run new -- work "某项目复盘"
 *   npm run new -- learn "操作系统课程笔记"
 *   npm run new -- products "产品名"
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SECTIONS = {
  blog: {
    dir: 'blog',
    extra: '',
  },
  work: {
    dir: 'work',
    extra: 'company: ""\nrole: ""\nperiod: ""\n',
  },
  learn: {
    dir: 'learn',
    extra: 'source: ""\nprogress: "在读"\n',
  },
  products: {
    dir: 'products',
    extra: 'productName: ""\nstatus: "已上线"\nlink: ""\nhighlights: []\n',
  },
};

const [sectionArg, ...titleParts] = process.argv.slice(2);
const section = SECTIONS[sectionArg];

if (!section || titleParts.length === 0) {
  console.error('用法：npm run new -- <blog|work|learn|products> "标题"');
  console.error('例如：npm run new -- blog "我为什么开始写博客"');
  process.exit(1);
}

const title = titleParts.join(' ').trim();

// 文件名：保留中文，去掉文件系统非法字符
const slug =
  title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'untitled';

const contentRoot = fileURLToPath(new URL('../content/', import.meta.url));
const dir = join(contentRoot, section.dir);
const file = join(dir, `${slug}.md`);

// 本地日期，避免时区导致日期差一天
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const body = `---
title: "${title.replace(/"/g, '\\"')}"
description: ""
pubDate: ${date}
tags: []
draft: true
${section.extra}---

在这里开始写。写完把 draft 改成 false，提交后就发布上线。

## 一个小标题

- 要点一
- 要点二
`;

await mkdir(dir, { recursive: true });

try {
  await access(file);
  console.error(`文件已存在，没有覆盖：${file}`);
  process.exit(1);
} catch {
  // 文件不存在，继续
}

await writeFile(file, body, 'utf8');
console.log(`已创建：${file}`);
console.log('提示：draft: true 时只在本地可见，改成 false 才会发布。');
