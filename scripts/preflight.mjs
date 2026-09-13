#!/usr/bin/env node
/**
 * 构建前的防呆检查：拦住那些会让网站"表现诡异"的常见问题。
 *
 * 检查项：
 *   1. src/ 下存在多个 content.config.* （会被合并集合，产生幽灵页面）
 *   2. 代码/配置文件带 UTF-8 BOM（会导致 Vite 解析异常）
 *   3. content/ 里的 Markdown 缺少 frontmatter 或必填字段
 *   4. 残留的备份/临时文件（.bak/.orig/.tmp）被当成源码加载
 *
 * 用法：
 *   node scripts/preflight.mjs          # 检查，有问题则非零退出
 *   node scripts/preflight.mjs --warn   # 只警告不失败
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';

const siteRoot = fileURLToPath(new URL('../', import.meta.url));
const WARN_ONLY = process.argv.includes('--warn');

const problems = [];
const warnings = [];

async function walk(dir, out = []) {
  let items;
  try {
    items = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const item of items) {
    if (item.name === 'node_modules' || item.name === 'dist' || item.name === '.astro') continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = await walk(siteRoot);
const rel = (file) => relative(siteRoot, file).split('\\').join('/');

/* 1. 多个 content.config.* ─────────────────────────────────────────── */

const contentConfigs = allFiles.filter((file) => /^src[\\/]content\.config\./.test(rel(file)));
if (contentConfigs.length > 1) {
  problems.push(
    `src/ 下有 ${contentConfigs.length} 个 content.config 文件，Astro 会一起加载并合并集合，` +
      `导致内容与源文件对不上（幽灵页面）：\n      ${contentConfigs.map(rel).join('\n      ')}`
  );
}

/* 2. 备份/临时文件残留 ───────────────────────────────────────────── */

const stray = allFiles.filter((file) => /\.(bak|orig|old|tmp)$/i.test(file) && !rel(file).startsWith('.tmp/'));
if (stray.length) {
  problems.push(`发现备份/临时文件残留，它们可能被 Astro 当成源码加载：\n      ${stray.map(rel).join('\n      ')}`);
}

/* 3. UTF-8 BOM ──────────────────────────────────────────────────── */

const textExtensions = new Set(['.ts', '.mjs', '.js', '.astro', '.json', '.css', '.yml', '.yaml']);
for (const file of allFiles) {
  if (!textExtensions.has(extname(file).toLowerCase())) continue;
  const buffer = await readFile(file);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    problems.push(`文件带 UTF-8 BOM（会导致 Vite 解析异常）：${rel(file)}`);
  }
}

/* 4. content/ 里的 frontmatter ──────────────────────────────────── */

const contentRoot = join(siteRoot, 'content');
if (existsSync(contentRoot)) {
  const sections = ['blog', 'work', 'learn', 'products'];
  for (const section of sections) {
    const dir = join(contentRoot, section);
    if (!existsSync(dir)) continue;
    for (const name of await readdir(dir)) {
      if (!/\.(md|mdx)$/i.test(name)) continue;
      const raw = (await readFile(join(dir, name), 'utf8')).replace(/^\uFEFF/, '');
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
      if (!match) {
        problems.push(`${section}/${name} 缺少 frontmatter`);
        continue;
      }
      let data;
      try {
        data = parseYaml(match[1]) ?? {};
      } catch (error) {
        problems.push(`${section}/${name} 的 frontmatter 不是合法 YAML：${error.message.split('\n')[0]}`);
        continue;
      }
      if (!data.title) problems.push(`${section}/${name} 缺少 title`);
      if (!data.pubDate) problems.push(`${section}/${name} 缺少 pubDate`);
      if (!data.description) warnings.push(`${section}/${name} 没有 description（列表页会缺摘要）`);
    }
  }
}

/* 输出 ─────────────────────────────────────────────────────────── */

for (const warning of warnings) console.log(`⚠  ${warning}`);

if (!problems.length) {
  console.log(`\n✓ 构建前检查通过（扫描 ${allFiles.length} 个文件）`);
  process.exit(0);
}

console.log('');
for (const problem of problems) console.log(`✗  ${problem}`);
console.log(`\n发现 ${problems.length} 个必须修的问题。`);

if (WARN_ONLY) {
  console.log('（--warn 模式：不影响退出码）');
  process.exit(0);
}
process.exit(1);
