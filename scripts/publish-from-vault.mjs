#!/usr/bin/env node
/**
 * 把知识库「90-发布」目录里的笔记同步到网站的 content/ 目录。
 *
 * 为什么需要它：网站发布的内容和你的知识库是同一批文件，但两边目录结构不同
 * （知识库是 90-发布/blog，网站是 content/blog）。这个脚本负责搬运，
 * 并且**在搬运时检查 frontmatter**，挡住会导致网站构建失败的坏数据。
 *
 * 用法：
 *   npm run publish              # 同步（只增改，不删）
 *   npm run publish -- --dry-run # 只看会发生什么，不写文件
 *   npm run publish -- --check   # 体检模式：校验 + 列出该删的孤儿文件
 *   npm run publish -- --vault "D:\Knowledge\vault"   # 手动指定知识库路径
 *
 * 知识库路径的查找顺序：--vault 参数 > PUBLISH_VAULT 环境变量 >
 * publish.config.json 的 vault > 常见的默认位置。
 */
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';

const siteRoot = fileURLToPath(new URL('../', import.meta.url));
const contentRoot = join(siteRoot, 'content');
const args = process.argv.slice(2);

const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const DRY_RUN = flag('dry-run');
const CHECK_ONLY = flag('check');

/* ------------------------------------------------------------------ */
/* 配置与路径                                                          */
/* ------------------------------------------------------------------ */

async function loadConfig() {
  const configPath = join(siteRoot, 'publish.config.json');
  const fallback = { sections: ['blog', 'work', 'learn', 'products'], exclude: ['README.md'], vault: '' };
  if (!existsSync(configPath)) return fallback;
  try {
    const raw = await readFile(configPath, 'utf8');
    return { ...fallback, ...JSON.parse(raw) };
  } catch (error) {
    console.error(`publish.config.json 解析失败：${error.message}`);
    process.exit(1);
  }
}

async function resolveVault(config) {
  const candidates = [
    option('vault'),
    process.env.PUBLISH_VAULT,
    config.vault,
    join(siteRoot, '..', 'vault'),                 // 本项目自带的示例知识库
    join(siteRoot, '..', '..', 'vault'),
    'D:\\Knowledge\\vault',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const publishDir = join(resolve(candidate), '90-发布');
    if (existsSync(publishDir)) {
      return { vault: resolve(candidate), publishDir };
    }
  }

  console.error('找不到知识库的「90-发布」目录。试过这些位置：');
  for (const candidate of candidates) console.error(`  - ${join(resolve(candidate), '90-发布')}`);
  console.error('\n用 --vault "你的仓库路径" 指定，或把路径写进 site/publish.config.json 的 vault 字段。');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* frontmatter 校验                                                    */
/* ------------------------------------------------------------------ */

/** 返回 { ok, data, body, errors, warnings, hadBom } */
function inspectMarkdown(rawInput, fileLabel) {
  const errors = [];
  const warnings = [];

  // Windows 上的编辑器/PowerShell 很容易写出带 BOM 的 UTF-8。
  // BOM 会让 frontmatter 的 --- 匹配失败，也会让 Astro 报奇怪的类型错误，
  // 所以这里直接剥掉，并在同步时写成无 BOM 的版本。
  const hadBom = rawInput.charCodeAt(0) === 0xfeff;
  const raw = hadBom ? rawInput.slice(1) : rawInput;
  if (hadBom) warnings.push('文件带 UTF-8 BOM，已自动移除');

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    errors.push('缺少 frontmatter（文件必须以 --- 开头，并以 --- 结束）');
    return { ok: false, data: null, body: '', errors, warnings, hadBom };
  }

  let data;
  try {
    data = parseYaml(match[1]) ?? {};
  } catch (error) {
    errors.push(`frontmatter 不是合法 YAML：${error.message.split('\n')[0]}`);
    return { ok: false, data: null, body: match[2], errors, warnings, hadBom };
  }

  if (!data.title || String(data.title).trim() === '') {
    errors.push('缺少 title');
  }
  if (!data.pubDate) {
    errors.push('缺少 pubDate（格式如 2026-02-14）');
  } else if (Number.isNaN(new Date(data.pubDate).valueOf())) {
    errors.push(`pubDate 无法解析为日期：${data.pubDate}`);
  }
  if (!data.description) {
    warnings.push('没有 description（列表页和搜索结果会缺少摘要）');
  }
  if (data.draft === true) {
    warnings.push('draft 为 true，发布后被强制设为 false');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(raw)) {
    errors.push('文件含有控制字符，可能是编码损坏');
  }

  return { ok: errors.length === 0, data, body: match[2], errors, warnings, hadBom };
}

/** 把 draft 改成 false；没有该字段就补一行。顺带去掉可能存在的 BOM。 */
function forcePublished(rawInput) {
  const raw = rawInput.replace(/^\uFEFF/, '');
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/.exec(raw);
  if (!match) return raw;

  const [, open, head, close, body] = match;
  const lines = head.split(/\r?\n/);
  const index = lines.findIndex((line) => /^draft\s*:/.test(line));

  if (index >= 0) lines[index] = 'draft: false';
  else lines.push('draft: false');

  return open + lines.join('\n') + close + body;
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

const config = await loadConfig();
const { vault, publishDir } = await resolveVault(config);

console.log(`知识库发布目录：${publishDir}`);
console.log(`网站内容目录：  ${contentRoot}`);
if (DRY_RUN) console.log('模式：          dry-run（不会写入任何文件）');
if (CHECK_ONLY) console.log('模式：          体检（只校验，不复制）');
console.log('');

const published = [];
const skipped = [];
const failed = [];
const expectedTargets = new Set();

for (const section of config.sections) {
  const sourceDir = join(publishDir, section);
  if (!existsSync(sourceDir)) continue;

  const files = (await readdir(sourceDir)).filter((name) => /\.(md|mdx)$/i.test(name));
  const targetDir = join(contentRoot, section);
  if (!DRY_RUN && !CHECK_ONLY) await mkdir(targetDir, { recursive: true });

  for (const name of files) {
    if (config.exclude?.includes(name)) continue;

    const sourcePath = join(sourceDir, name);
    const targetPath = join(targetDir, name);
    const label = `${section}/${name}`;
    expectedTargets.add(resolve(targetPath));

    const raw = await readFile(sourcePath, 'utf8');
    const report = inspectMarkdown(raw, label);

    if (!report.ok) {
      failed.push({ label, errors: report.errors });
      continue;
    }

    const nextRaw = forcePublished(raw);
    let changed = true;
    if (existsSync(targetPath)) {
      const current = await readFile(targetPath, 'utf8');
      changed = current !== nextRaw;
    }

    if (CHECK_ONLY) {
      published.push({ label, changed });
      continue;
    }

    if (changed && !DRY_RUN) {
      await writeFile(targetPath, nextRaw, 'utf8');
    }
    published.push({ label, changed, warnings: report.warnings });
  }
}

/* 孤儿文件（网站在、知识库已经删了） */
const ignoreOrphans = new Set((config.ignoreOrphans ?? []).map((name) => name.split('/').join(sep)));
const orphans = [];
for (const section of config.sections) {
  const targetDir = join(contentRoot, section);
  if (!existsSync(targetDir)) continue;
  for (const name of await readdir(targetDir)) {
    if (!/\.(md|mdx)$/i.test(name)) continue;
    const relativeName = `${section}${sep}${name}`;
    if (ignoreOrphans.has(relativeName)) continue;
    if (!expectedTargets.has(resolve(join(targetDir, name)))) {
      orphans.push(`${section}/${name}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 输出                                                                */
/* ------------------------------------------------------------------ */

if (published.length) {
  console.log(`已发布 ${published.length} 篇：`);
  for (const item of published) {
    const mark = item.changed ? (CHECK_ONLY ? '需要更新' : '已同步  ') : '无变化  ';
    console.log(`  [${mark}] ${item.label}`);
    for (const warning of item.warnings ?? []) console.log(`             ⚠ ${warning}`);
  }
}

if (failed.length) {
  console.log(`\n❌ ${failed.length} 篇有问题，已跳过（不修好会导致网站构建失败）：`);
  for (const item of failed) {
    console.log(`  ${item.label}`);
    for (const error of item.errors) console.log(`      - ${error}`);
  }
}

if (orphans.length) {
  console.log(`\n⚠ content/ 里有 ${orphans.length} 个文件在知识库中已不存在：`);
  for (const name of orphans) console.log(`  ${name}`);
  console.log('  这些内容仍会发布在网站上。要撤下就手动删除，或运行：');
  for (const name of orphans) {
    const [section, ...rest] = name.split('/');
    console.log(`  Remove-Item "content${sep}${section}${sep}${rest.join('/')}"`);
  }
}

console.log('');
if (CHECK_ONLY) {
  if (failed.length) {
    console.log(`体检完成：${failed.length} 篇需要修，其余可正常发布。`);
  } else {
    console.log('体检完成，没有发现会阻断构建的问题。');
  }
} else if (DRY_RUN) {
  console.log(
    failed.length
      ? `dry-run 完成。${published.length} 篇可发布，${failed.length} 篇需先修好。没有写入任何文件。`
      : 'dry-run 完成，没有写入任何文件。去掉 --dry-run 即可真正同步。'
  );
} else {
  // 故意不用非零退出码：单个草稿的 frontmatter 写错，不应该阻断其他内容的发布。
  console.log(
    failed.length
      ? `同步完成：${published.length} 篇已更新，${failed.length} 篇因校验失败被跳过（见上方说明）。`
      : '同步完成。接着执行：git add . && git commit -m "发布内容" && git push'
  );
  if (published.length && !failed.length) {
    console.log('接下来：npm run build 本地确认，然后 git push 上线。');
  }
}
