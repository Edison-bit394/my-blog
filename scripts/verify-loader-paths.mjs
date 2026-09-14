#!/usr/bin/env node
/**
 * 验证内容 loader 满足 Astro 的路径契约。
 *
 * 为什么需要这个测试：Astro 要求 store.set() 的 filePath 是「相对站点根目录」的路径。
 * 传绝对路径在 Windows 上能侥幸通过（Astro 校验里有盘符分支），
 * 但在 Linux CI 上会直接失败：
 *   File path must be relative to the site root. Got: /home/runner/work/...
 *
 * 这个 bug 只在部署后才暴露，本地 build 永远测不出来。
 * 所以这里不跑构建，而是直接调用 loader、检查它塞进 store 的路径长什么样。
 *
 * 用法：node scripts/verify-loader-paths.mjs
 */
import { markdownDir } from '../src/loaders/markdown-dir.ts';

const sections = ['blog', 'work', 'learn', 'products'];
const problems = [];

/** 假的 store：把 loader 写入的内容收集起来，不落盘 */
function createFakeStore() {
  const entries = [];
  return {
    entries,
    set(entry) {
      entries.push(entry);
    },
    get(id) {
      return entries.find((e) => e.id === id);
    },
    has(id) {
      return entries.some((e) => e.id === id);
    },
    delete(id) {
      const index = entries.findIndex((e) => e.id === id);
      if (index >= 0) entries.splice(index, 1);
    },
    clear() {
      entries.length = 0;
    },
    keys() {
      return entries.map((e) => e.id);
    },
    values() {
      return entries;
    },
  };
}

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  label: 'verify',
};

let total = 0;

for (const section of sections) {
  const dir = `content/${section}`;
  const loader = markdownDir(dir);
  const store = createFakeStore();

  try {
    await loader.load({
      store,
      logger: noopLogger,
      // 只做透传，重点是看 filePath 字段
      parseData: async ({ id, data }) => data,
      generateDigest: (text) => `digest-${text.length}`,
      watcher: null,
      config: {},
      collection: section,
      meta: {},
      renderMarkdown: async () => ({ code: '' }),
      refreshContextData: undefined,
    });
  } catch (error) {
    problems.push(`${dir}: loader 执行失败 —— ${error.message}`);
    continue;
  }

  console.log(`${dir}：读到 ${store.entries.length} 篇`);

  for (const entry of store.entries) {
    total += 1;
    const { filePath } = entry;

    if (!filePath) {
      problems.push(`${dir}/${entry.id}: filePath 为空`);
      continue;
    }

    // Astro 的硬性要求 1：不能是绝对路径
    const isAbsolute = filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath) || filePath.startsWith('\\\\');
    if (isAbsolute) {
      problems.push(`${dir}/${entry.id}: filePath 是绝对路径「${filePath}」—— Linux 上会构建失败`);
    }

    // Astro 的硬性要求 2：不能跳出站点根目录
    if (filePath.split(/[\\/]/).includes('..')) {
      problems.push(`${dir}/${entry.id}: filePath 跳出了站点根目录「${filePath}」`);
    }

    // 统一用正斜杠，避免 Windows 反斜杠在其他环节出问题
    if (filePath.includes('\\')) {
      problems.push(`${dir}/${entry.id}: filePath 含反斜杠「${filePath}」，应统一为正斜杠`);
    }

    // 应当能从站点根目录定位到真实文件
    if (!filePath.startsWith(`content${'/'}`)) {
      problems.push(`${dir}/${entry.id}: filePath 没有以 content/ 开头「${filePath}」`);
    }

    console.log(`    ${entry.id}  →  ${filePath}`);
  }
}

console.log('');
if (!total) {
  problems.push('没有读到任何内容 —— 说明 loader 根本没工作，或 content/ 目录是空的');
}

if (problems.length) {
  console.log(`✗ 发现 ${problems.length} 个问题：`);
  for (const p of problems) console.log(`   ${p}`);
  console.log('');
  console.log('修复方向：loader 里的 filePath 必须用 relative(process.cwd(), 绝对路径) 转换，');
  console.log('不要直接把绝对路径传给 store.set()。');
  process.exit(1);
}

console.log(`✓ 路径契约检查通过（${total} 篇内容，filePath 全部为相对路径且使用正斜杠）`);
